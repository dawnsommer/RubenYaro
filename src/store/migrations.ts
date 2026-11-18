import { AppData } from '../types';
import { buildDefaultSettings } from './seed';

export const CURRENT_SCHEMA_VERSION = 1;

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

  // Ensure v1 fields (`maybe`, `variants`, etc.) exist on any older or partial state
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

  return {
    settings: {
      ...defaultSettings,
      ...(state.settings ?? {}),
      schemaVersion: Math.max(version || 1, CURRENT_SCHEMA_VERSION),
    },
    accounts: Array.isArray(state.accounts) ? state.accounts : [],
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    costs,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
  };
}
