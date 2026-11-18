import { nanoid } from 'nanoid';
import { AppData } from '../types';
import { buildDefaultSettings } from './seed';

export const CURRENT_SCHEMA_VERSION = 2;

export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.settings === 'object' &&
    v.settings !== null &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.transactions) &&
    Array.isArray(v.costs) &&
    Array.isArray(v.tasks)
  );
}

export function migrate(persistedState: unknown, version: number): AppData {
  const defaultSettings = buildDefaultSettings();

  if (!persistedState || typeof persistedState !== 'object') {
    return {
      settings: defaultSettings,
      accounts: [],
      transactions: [],
      costs: [],
      tasks: [],
    };
  }

  const state = persistedState as Partial<AppData>;

  const costs = Array.isArray(state.costs)
    ? state.costs.map((c) => ({
        ...c,
        maybe: typeof c.maybe === 'boolean' ? c.maybe : false,
        included: typeof c.included === 'boolean' ? c.included : true,
        archived: typeof c.archived === 'boolean' ? c.archived : false,
        subCosts: Array.isArray(c.subCosts)
          ? c.subCosts.map((sc) => ({
              ...sc,
              included: typeof sc.included === 'boolean' ? sc.included : true,
              maybe: typeof sc.maybe === 'boolean' ? sc.maybe : false,
            }))
          : [],
      }))
    : [];

  // v2 migration: inject "Visa Interview" cost if migrating from <2 and not already present
  if (
    version < 2 &&
    costs.length > 0 &&
    !costs.some((c) => c.name.toLowerCase() === 'visa interview')
  ) {
    const now = new Date().toISOString();
    costs.push({
      id: nanoid(10),
      name: 'Visa Interview',
      money: { amount: 60000, currency: 'PKR' },
      kind: 'fixed',
      categoryId: 'travel',
      phaseId: 'usa',
      priority: 'must',
      subCosts: [
        {
          id: nanoid(10),
          name: 'Plane ticket',
          money: { amount: 50000, currency: 'PKR' },
          kind: 'fixed',
          order: 0,
          included: true,
          maybe: false,
        },
        {
          id: nanoid(10),
          name: 'Hotel and food',
          money: { amount: 10000, currency: 'PKR' },
          kind: 'fixed',
          order: 1,
          included: true,
          maybe: false,
        },
      ],
      maybe: false,
      included: true,
      archived: false,
      order: costs.length,
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  const tasks = Array.isArray(state.tasks)
    ? state.tasks.map((t, idx) => ({
        ...t,
        pinned:
          typeof t.pinned === 'boolean'
            ? t.pinned
            : version < 2 && idx < 3
              ? true
              : false,
      }))
    : [];

  return {
    settings: {
      ...defaultSettings,
      ...(state.settings ?? {}),
      schemaVersion: Math.max(version || 1, CURRENT_SCHEMA_VERSION),
    },
    accounts: Array.isArray(state.accounts) ? state.accounts : [],
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    costs,
    tasks,
  };
}
