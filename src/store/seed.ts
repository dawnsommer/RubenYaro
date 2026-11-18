import { nanoid } from 'nanoid';
import seedJson from '../../docs/seed.json';
import {
  Account,
  AppData,
  Category,
  Cost,
  CostKind,
  CostVariant,
  Currency,
  InheritancePlan,
  Money,
  Phase,
  Priority,
  Recurrence,
  Settings,
  SubCost,
  Task,
  Transaction,
} from '../types';

export interface SeedSubCostInput {
  id?: string;
  name: string;
  money: Money;
  range?: { low: number; high: number };
  kind?: CostKind;
  included?: boolean;
  maybe?: boolean;
  verify?: boolean;
  dueDate?: string;
  note?: string;
  url?: string;
}

export interface SeedVariantInput {
  id?: string;
  name: string;
  money: Money;
  range?: { low: number; high: number };
  subCosts?: SeedSubCostInput[];
  note?: string;
}

export interface SeedCostInput {
  id?: string;
  name: string;
  phase?: string;
  phaseId?: string;
  category?: string;
  categoryId?: string;
  money: Money;
  range?: { low: number; high: number };
  kind?: CostKind;
  priority?: Priority;
  dueDate?: string;
  temporary?: { start: string; end: string };
  recurrence?: Partial<Recurrence> & {
    frequency: 'weekly' | 'monthly' | 'yearly';
    interval: number;
    occurrences: number;
  };
  subCosts?: SeedSubCostInput[];
  variants?: SeedVariantInput[];
  activeVariant?: string;
  activeVariantId?: string;
  maybe?: boolean;
  included?: boolean;
  archived?: boolean;
  verify?: boolean;
  note?: string;
  url?: string;
  tags?: string[];
}

export interface SeedTaskInput {
  id?: string;
  title: string;
  note?: string;
  phase?: string;
  phaseId?: string;
  status?: 'todo' | 'doing' | 'done';
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  checklist?: (string | { id?: string; text: string; done?: boolean })[];
  linkedCost?: string;
  linkedCostId?: string;
  progress?: { current: number; total: number; unit: string };
  pinned?: boolean;
}

export interface SeedAccountInput {
  id?: string;
  name: string;
  kind?: Account['kind'];
  currency?: Currency;
  openingBalance?: number;
  balance?: number;
  color?: string;
  icon?: string;
  note?: string;
  includeInTotals?: boolean;
  reserved?: number;
  archived?: boolean;
}

export interface SeedFormatInput {
  settings?: Partial<Settings>;
  phases?: { key?: string; id?: string; name: string; color: string; order?: number }[];
  categories?: { key?: string; id?: string; name: string; color: string; icon: string }[];
  accounts?: SeedAccountInput[];
  transactions?: Partial<Transaction>[];
  costs?: SeedCostInput[];
  tasks?: SeedTaskInput[];
  inheritance?: InheritancePlan | null;
}

export function buildDefaultPhases(): Phase[] {
  return (seedJson.phases ?? []).map((p, idx) => ({
    id: p.key,
    name: p.name,
    order: idx,
    color: p.color,
  }));
}

export function buildDefaultCategories(): Category[] {
  return (seedJson.categories ?? []).map((c) => ({
    id: c.key,
    name: c.name,
    color: c.color,
    icon: c.icon,
  }));
}

export function buildDefaultSettings(): Settings {
  const s = seedJson.settings;
  return {
    schemaVersion: 1,
    displayCurrency: (s?.displayCurrency as Currency) ?? 'PKR',
    rates: {
      market: s?.rates?.market ?? 280,
      marketSource: (s?.rates?.marketSource as 'auto' | 'manual') ?? 'auto',
      marketUpdatedAt: null,
      marketProvider: null,
      effective: s?.rates?.effective ?? 300,
    },
    defaultConversionMode:
      (s?.defaultConversionMode as Settings['defaultConversionMode']) ?? 'effective',
    defaultTax: {
      kind: (s?.defaultTax?.kind as 'percent' | 'fixed') ?? 'percent',
      value: s?.defaultTax?.value ?? 0,
    },
    theme: 'system',
    privacyMode: false,
    journey: {
      targetDate: null,
      examDates: [],
    },
    categories: buildDefaultCategories(),
    phases: buildDefaultPhases(),
  };
}

function mapSubCost(sc: SeedSubCostInput, idx: number): SubCost {
  return {
    id: sc.id ?? nanoid(10),
    name: sc.name,
    money: { amount: sc.money.amount, currency: sc.money.currency },
    range: sc.range,
    kind: sc.kind ?? 'fixed',
    note: sc.note,
    url: sc.url,
    order: idx,
    included: sc.included ?? true,
    maybe: sc.maybe ?? false,
    dueDate: sc.dueDate,
  };
}

function mapVariant(v: SeedVariantInput): CostVariant {
  return {
    id: v.id ?? nanoid(10),
    name: v.name,
    money: { amount: v.money.amount, currency: v.money.currency },
    range: v.range,
    subCosts: (v.subCosts ?? []).map(mapSubCost),
    note: v.note,
  };
}

export function mapSeedToAppData(
  input: SeedFormatInput = seedJson as unknown as SeedFormatInput,
  baseData?: AppData
): AppData {
  const now = new Date().toISOString();
  const baseSettings = baseData?.settings ?? buildDefaultSettings();

  const phases: Phase[] = input.phases
    ? input.phases.map((p, idx) => ({
        id: p.id ?? p.key ?? nanoid(8),
        name: p.name,
        order: p.order ?? idx,
        color: p.color,
      }))
    : baseSettings.phases;

  const categories: Category[] = input.categories
    ? input.categories.map((c) => ({
        id: c.id ?? c.key ?? nanoid(8),
        name: c.name,
        color: c.color,
        icon: c.icon,
      }))
    : baseSettings.categories;

  const settings: Settings = {
    ...baseSettings,
    ...(input.settings ?? {}),
    rates: {
      ...baseSettings.rates,
      ...(input.settings?.rates ?? {}),
    },
    defaultTax: {
      ...baseSettings.defaultTax,
      ...(input.settings?.defaultTax ?? {}),
    },
    journey: {
      ...baseSettings.journey,
      ...(input.settings?.journey ?? {}),
    },
    phases,
    categories,
  };

  const accounts: Account[] = (input.accounts ?? []).map((a, idx) => ({
    id: a.id ?? nanoid(10),
    name: a.name,
    kind: a.kind ?? 'bank',
    currency: a.currency ?? 'PKR',
    openingBalance: a.openingBalance ?? a.balance ?? 0,
    color: a.color ?? '#6366F1',
    icon: a.icon ?? 'Wallet',
    note: a.note,
    includeInTotals: a.includeInTotals ?? true,
    reserved: a.reserved,
    archived: a.archived ?? false,
    order: idx,
    createdAt: now,
  }));

  const costs: Cost[] = (input.costs ?? []).map((c, idx) => {
    const variants = c.variants ? c.variants.map(mapVariant) : undefined;
    let activeVariantId = c.activeVariantId;
    if (!activeVariantId && variants && variants.length > 0) {
      const matched = c.activeVariant
        ? variants.find((v) => v.name.toLowerCase() === c.activeVariant!.toLowerCase())
        : undefined;
      activeVariantId = matched ? matched.id : variants[0].id;
    }

    const subCosts = (c.subCosts ?? []).map(mapSubCost);
    const hasVerifySub =
      c.verify ||
      (c.subCosts ?? []).some((s) => s.verify) ||
      (c.variants ?? []).some((v) => (v.subCosts ?? []).some((s) => s.verify));

    return {
      id: c.id ?? nanoid(10),
      name: c.name,
      money: c.money ?? { amount: 0, currency: 'PKR' },
      range: c.range,
      kind: c.kind ?? 'fixed',
      note: c.note,
      url: c.url,
      categoryId: c.categoryId ?? c.category ?? categories[0]?.id ?? 'misc',
      phaseId: c.phaseId ?? c.phase ?? phases[0]?.id ?? 'general',
      priority: c.priority ?? 'must',
      dueDate: c.dueDate,
      temporary: c.temporary,
      recurrence: c.recurrence
        ? {
            frequency: c.recurrence.frequency,
            interval: c.recurrence.interval,
            occurrences: c.recurrence.occurrences,
            startDate: c.recurrence.startDate ?? now.slice(0, 10),
          }
        : undefined,
      subCosts,
      variants,
      activeVariantId,
      maybe: c.maybe ?? false,
      included: c.included ?? true,
      archived: c.archived ?? false,
      order: idx,
      tags: c.tags ?? [],
      verify: hasVerifySub || undefined,
      createdAt: now,
      updatedAt: now,
    };
  });

  const allCostsForLookup = [...(baseData?.costs ?? []), ...costs];

  const tasks: Task[] = (input.tasks ?? []).map((t, idx) => {
    let linkedCostId = t.linkedCostId;
    if (!linkedCostId && t.linkedCost) {
      const found = allCostsForLookup.find(
        (c) => c.name.toLowerCase() === t.linkedCost!.toLowerCase()
      );
      if (found) linkedCostId = found.id;
    }

    const checklist = (t.checklist ?? []).map((item) =>
      typeof item === 'string'
        ? { id: nanoid(8), text: item, done: false }
        : { id: item.id ?? nanoid(8), text: item.text, done: item.done ?? false }
    );

    return {
      id: t.id ?? nanoid(10),
      title: t.title,
      note: t.note,
      phaseId: t.phaseId ?? t.phase,
      status: t.status ?? 'todo',
      priority: t.priority ?? 'must',
      dueDate: t.dueDate,
      tags: t.tags ?? [],
      checklist,
      linkedCostId,
      progress: t.progress,
      pinned: t.pinned ?? false,
      order: idx,
      createdAt: now,
    };
  });

  const transactions: Transaction[] = (input.transactions ?? []).map((tx) => ({
    id: tx.id ?? nanoid(10),
    type: tx.type ?? 'deposit',
    date: tx.date ?? now.slice(0, 10),
    accountId: tx.accountId ?? accounts[0]?.id ?? '',
    toAccountId: tx.toAccountId,
    amount: tx.amount ?? 0,
    toAmount: tx.toAmount,
    costId: tx.costId,
    subCostId: tx.subCostId,
    note: tx.note,
    createdAt: tx.createdAt ?? now,
  }));

  return {
    settings,
    accounts,
    transactions,
    costs,
    tasks,
    inheritance: input.inheritance ?? baseData?.inheritance ?? null,
  };
}

/** Union by id: keeps existing entries, incoming ones with the same id win, new ones are appended. */
function unionById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const out = [...existing];
  for (const item of incoming) {
    const i = out.findIndex((x) => x.id === item.id);
    if (i >= 0) out[i] = { ...out[i], ...item };
    else out.push(item);
  }
  return out;
}

export function mergeSeedIntoAppData(current: AppData, incoming: SeedFormatInput): AppData {
  const mapped = mapSeedToAppData(incoming, current);

  // Merge accounts by name (update if exists, append if new)
  const mergedAccounts = [...current.accounts];
  for (const acc of mapped.accounts) {
    const existingIdx = mergedAccounts.findIndex(
      (a) => a.name.toLowerCase() === acc.name.toLowerCase()
    );
    if (existingIdx >= 0) {
      mergedAccounts[existingIdx] = {
        ...mergedAccounts[existingIdx],
        ...acc,
        id: mergedAccounts[existingIdx].id,
      };
    } else {
      mergedAccounts.push({ ...acc, order: mergedAccounts.length });
    }
  }

  // Merge costs by name (update if exists, append if new)
  const mergedCosts = [...current.costs];
  for (const cost of mapped.costs) {
    const existingIdx = mergedCosts.findIndex(
      (c) => c.name.toLowerCase() === cost.name.toLowerCase()
    );
    if (existingIdx >= 0) {
      mergedCosts[existingIdx] = {
        ...mergedCosts[existingIdx],
        ...cost,
        id: mergedCosts[existingIdx].id,
      };
    } else {
      mergedCosts.push({ ...cost, order: mergedCosts.length });
    }
  }

  // Merge tasks by title
  const mergedTasks = [...current.tasks];
  for (const task of mapped.tasks) {
    const existingIdx = mergedTasks.findIndex(
      (t) => t.title.toLowerCase() === task.title.toLowerCase()
    );
    if (existingIdx >= 0) {
      mergedTasks[existingIdx] = {
        ...mergedTasks[existingIdx],
        ...task,
        id: mergedTasks[existingIdx].id,
      };
    } else {
      mergedTasks.push({ ...task, order: mergedTasks.length });
    }
  }

  // Merge transactions by id
  const mergedTxns = [...current.transactions];
  for (const tx of mapped.transactions) {
    if (!mergedTxns.some((t) => t.id === tx.id)) {
      mergedTxns.push(tx);
    }
  }

  // Merging never drops your own categories/phases — incoming ones are added (or updated by id).
  const settings: Settings = {
    ...mapped.settings,
    categories: incoming.categories
      ? unionById(current.settings.categories, mapped.settings.categories)
      : current.settings.categories,
    phases: incoming.phases
      ? unionById(current.settings.phases, mapped.settings.phases)
      : current.settings.phases,
  };

  return {
    settings,
    inheritance: incoming.inheritance ?? current.inheritance ?? null,
    accounts: mergedAccounts,
    transactions: mergedTxns,
    costs: mergedCosts,
    tasks: mergedTasks,
  };
}

export function buildEmptyAppData(): AppData {
  return {
    settings: buildDefaultSettings(),
    accounts: [],
    transactions: [],
    costs: [],
    tasks: [],
    inheritance: null,
  };
}

export function buildSeededAppData(): AppData {
  return mapSeedToAppData(seedJson as unknown as SeedFormatInput);
}
