import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import {
  Account,
  AppData,
  Category,
  Cost,
  Extra,
  InheritancePlan,
  KeyDate,
  Phase,
  Settings,
  SubCost,
  Task,
  Transaction,
} from '../types';
import {
  buildDefaultSettings,
  buildEmptyAppData,
  buildSeededAppData,
  mapSeedToAppData,
  mergeSeedIntoAppData,
  SeedFormatInput,
} from './seed';
import { CURRENT_SCHEMA_VERSION, isValidAppData, migrate } from './migrations';
import { linkCostToLender, syncLinkedLoanCosts } from './loanLinks';

export const PERSIST_KEY = 'rubenyaro:v1';
export const SNAPSHOTS_KEY = 'rubenyaro:snapshots';

export interface SnapshotEntry {
  date: string; // YYYY-MM-DD
  createdAt: string;
  data: AppData;
}

/** The persisted / synced part of the store. */
export function pickAppData(state: AppData): AppData {
  return {
    settings: state.settings,
    accounts: state.accounts,
    transactions: state.transactions,
    costs: state.costs,
    tasks: state.tasks,
    inheritance: state.inheritance ?? null,
    extras: state.extras ?? [],
  };
}

export interface ExportBundle extends AppData {
  exportedAt: string;
  schemaVersion: number;
}

export interface StoreActions {
  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
  updateRates: (patch: Partial<Settings['rates']>) => void;
  addCategory: (cat: Omit<Category, 'id'> & { id?: string }) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string, reassignToId?: string) => void;
  addPhase: (phase: Omit<Phase, 'id' | 'order'> & { id?: string; order?: number }) => Phase;
  updatePhase: (id: string, patch: Partial<Phase>) => void;
  deletePhase: (id: string, reassignToId?: string) => void;
  addKeyDate: (kd: Omit<KeyDate, 'id'> & { id?: string }) => KeyDate;
  updateKeyDate: (id: string, patch: Partial<KeyDate>) => void;
  deleteKeyDate: (id: string) => void;

  // Accounts
  addAccount: (
    acc: Omit<Account, 'id' | 'createdAt' | 'order' | 'archived'> &
      Partial<Pick<Account, 'id' | 'createdAt' | 'order' | 'archived'>>
  ) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (orderedIds: string[]) => void;

  // Transactions
  addTransaction: (
    tx: Omit<Transaction, 'id' | 'createdAt'> & Partial<Pick<Transaction, 'id' | 'createdAt'>>
  ) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Costs
  addCost: (
    cost: Omit<
      Cost,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'order'
      | 'archived'
      | 'included'
      | 'maybe'
      | 'subCosts'
      | 'tags'
    > &
      Partial<
        Pick<
          Cost,
          | 'id'
          | 'createdAt'
          | 'updatedAt'
          | 'order'
          | 'archived'
          | 'included'
          | 'maybe'
          | 'subCosts'
          | 'tags'
        >
      >
  ) => Cost;
  updateCost: (id: string, patch: Partial<Cost>) => void;
  deleteCost: (id: string) => void;
  reorderCosts: (orderedIds: string[]) => void;
  addSubCost: (
    costId: string,
    sub: Omit<SubCost, 'id' | 'order' | 'included' | 'maybe'> &
      Partial<Pick<SubCost, 'id' | 'order' | 'included' | 'maybe'>>
  ) => SubCost | null;
  updateSubCost: (costId: string, subCostId: string, patch: Partial<SubCost>) => void;
  deleteSubCost: (costId: string, subCostId: string) => void;

  // Tasks
  addTask: (
    task: Omit<Task, 'id' | 'createdAt' | 'order' | 'checklist' | 'tags'> &
      Partial<Pick<Task, 'id' | 'createdAt' | 'order' | 'checklist' | 'tags'>>
  ) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (orderedIds: string[]) => void;

  // Loan costs ↔ people I owe (v6)
  linkCostToLender: (costId: string, lenderId: string) => void;
  unlinkCost: (costId: string) => void;

  // Extras: things I could sell / money I expect (v6)
  addExtra: (extra: Omit<Extra, 'id' | 'order' | 'createdAt'>) => Extra;
  updateExtra: (id: string, patch: Partial<Extra>) => void;
  deleteExtra: (id: string) => void;
  /** It came in: deposit `amount` (account currency) into my account and mark the extra received. */
  receiveExtra: (id: string, accountId: string, amount: number, date: string) => void;
  /** Undo "received": removes the deposit too. */
  unreceiveExtra: (id: string) => void;

  // Inheritance (stand-alone planner)
  setInheritance: (plan: InheritancePlan | null) => void;

  // Seed, Export, Import, Reset
  loadStarterData: () => void;
  resetAllData: () => void;
  exportJSON: () => ExportBundle;
  importJSON: (raw: unknown, mode?: 'replace' | 'merge') => { ok: boolean; error?: string };
}

export type RubenYaroStore = AppData & StoreActions;

function createDebouncedStorage(delayMs = 300): StateStorage {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const memoryFallback = new Map<string, string>();

  const getBacking = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  };

  return {
    getItem: (name: string): string | null => {
      const backing = getBacking();
      if (!backing) return memoryFallback.get(name) ?? null;
      return backing.getItem(name);
    },
    setItem: (name: string, value: string): void => {
      const backing = getBacking();
      if (!backing) {
        memoryFallback.set(name, value);
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        backing.setItem(name, value);
      }, delayMs);
    },
    removeItem: (name: string): void => {
      const backing = getBacking();
      if (!backing) {
        memoryFallback.delete(name);
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);
      backing.removeItem(name);
    },
  };
}

export function saveDailySnapshot(data: AppData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
    const list: SnapshotEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((s) => s.date !== today);
    filtered.push({
      date: today,
      createdAt: new Date().toISOString(),
      data,
    });
    const ring = filtered.slice(-5);
    window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(ring));
  } catch {
    // Ignore storage quota errors on snapshots
  }
}

export function getSnapshots(): SnapshotEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? (JSON.parse(raw) as SnapshotEntry[]) : [];
  } catch {
    return [];
  }
}

const initialSeedData = buildSeededAppData();

export const useStore = create<RubenYaroStore>()(
  persist(
    (set, get) => ({
      ...initialSeedData,

      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),

      updateRates: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            rates: { ...state.settings.rates, ...patch },
          },
        })),

      addCategory: (cat) => {
        const created: Category = {
          id: cat.id ?? nanoid(8),
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
        };
        set((state) => ({
          settings: {
            ...state.settings,
            categories: [...state.settings.categories, created],
          },
        }));
        return created;
      },

      updateCategory: (id, patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            categories: state.settings.categories.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
          },
        })),

      deleteCategory: (id, reassignToId) =>
        set((state) => {
          const remaining = state.settings.categories.filter((c) => c.id !== id);
          const fallbackId = reassignToId ?? remaining[0]?.id ?? 'misc';
          return {
            settings: { ...state.settings, categories: remaining },
            costs: state.costs.map((cost) =>
              cost.categoryId === id ? { ...cost, categoryId: fallbackId } : cost
            ),
          };
        }),

      addPhase: (phase) => {
        const created: Phase = {
          id: phase.id ?? nanoid(8),
          name: phase.name,
          color: phase.color,
          order: phase.order ?? get().settings.phases.length,
        };
        set((state) => ({
          settings: {
            ...state.settings,
            phases: [...state.settings.phases, created],
          },
        }));
        return created;
      },

      updatePhase: (id, patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            phases: state.settings.phases.map((p) =>
              p.id === id ? { ...p, ...patch } : p
            ),
          },
        })),

      deletePhase: (id, reassignToId) =>
        set((state) => {
          const remaining = state.settings.phases.filter((p) => p.id !== id);
          const fallbackId = reassignToId ?? remaining[0]?.id ?? 'general';
          return {
            settings: { ...state.settings, phases: remaining },
            costs: state.costs.map((cost) =>
              cost.phaseId === id ? { ...cost, phaseId: fallbackId } : cost
            ),
            tasks: state.tasks.map((task) =>
              task.phaseId === id ? { ...task, phaseId: fallbackId } : task
            ),
          };
        }),

      addKeyDate: (kd) => {
        const created: KeyDate = {
          id: kd.id ?? nanoid(8),
          label: kd.label,
          date: kd.date,
          kind: kd.kind,
        };
        set((state) => ({
          settings: {
            ...state.settings,
            journey: {
              ...state.settings.journey,
              examDates: [...state.settings.journey.examDates, created],
            },
          },
        }));
        return created;
      },

      updateKeyDate: (id, patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            journey: {
              ...state.settings.journey,
              examDates: state.settings.journey.examDates.map((k) =>
                k.id === id ? { ...k, ...patch } : k
              ),
            },
          },
        })),

      deleteKeyDate: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            journey: {
              ...state.settings.journey,
              examDates: state.settings.journey.examDates.filter((k) => k.id !== id),
            },
          },
        })),

      // Accounts
      addAccount: (acc) => {
        const now = new Date().toISOString();
        const created: Account = {
          id: acc.id ?? nanoid(10),
          name: acc.name,
          kind: acc.kind,
          role: acc.role ?? 'funding',
          currency: acc.currency,
          openingBalance: acc.openingBalance,
          color: acc.color,
          icon: acc.icon,
          note: acc.note,
          includeInTotals: acc.includeInTotals,
          reserved: acc.reserved,
          archived: acc.archived ?? false,
          order: acc.order ?? get().accounts.length,
          createdAt: acc.createdAt ?? now,
        };
        set((state) => ({ accounts: [...state.accounts, created] }));
        return created;
      },

      updateAccount: (id, patch) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          transactions: state.transactions.filter(
            (t) => t.accountId !== id && t.toAccountId !== id
          ),
        })),

      reorderAccounts: (orderedIds) =>
        set((state) => {
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            accounts: state.accounts
              .map((a) => ({ ...a, order: orderMap.get(a.id) ?? a.order }))
              .sort((a, b) => a.order - b.order),
          };
        }),

      // Transactions
      addTransaction: (tx) => {
        const now = new Date().toISOString();
        const created: Transaction = {
          id: tx.id ?? nanoid(10),
          type: tx.type,
          date: tx.date,
          accountId: tx.accountId,
          toAccountId: tx.toAccountId,
          amount: tx.amount,
          toAmount: tx.toAmount,
          costId: tx.costId,
          subCostId: tx.subCostId,
          note: tx.note,
          createdAt: tx.createdAt ?? now,
        };
        set((state) => ({ transactions: [...state.transactions, created] }));
        return created;
      },

      updateTransaction: (id, patch) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      // Costs
      addCost: (cost) => {
        const now = new Date().toISOString();
        const created: Cost = {
          id: cost.id ?? nanoid(10),
          name: cost.name,
          money: cost.money,
          range: cost.range,
          kind: cost.kind,
          conversionMode: cost.conversionMode,
          tax: cost.tax,
          note: cost.note,
          url: cost.url,
          categoryId: cost.categoryId,
          phaseId: cost.phaseId,
          priority: cost.priority,
          dueDate: cost.dueDate,
          temporary: cost.temporary,
          recurrence: cost.recurrence,
          subCosts: cost.subCosts ?? [],
          variants: cost.variants,
          activeVariantId: cost.activeVariantId,
          maybe: cost.maybe ?? false,
          included: cost.included ?? true,
          archived: cost.archived ?? false,
          order: cost.order ?? get().costs.length,
          tags: cost.tags ?? [],
          verify: cost.verify,
          createdAt: cost.createdAt ?? now,
          updatedAt: cost.updatedAt ?? now,
        };
        set((state) => ({ costs: [...state.costs, created] }));
        return created;
      },

      updateCost: (id, patch) =>
        set((state) => ({
          costs: state.costs.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
          ),
        })),

      deleteCost: (id) =>
        set((state) => ({
          costs: state.costs.filter((c) => c.id !== id),
          transactions: state.transactions.filter((t) => t.costId !== id),
        })),

      reorderCosts: (orderedIds) =>
        set((state) => {
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            costs: state.costs
              .map((c) => ({ ...c, order: orderMap.get(c.id) ?? c.order }))
              .sort((a, b) => a.order - b.order),
          };
        }),

      addSubCost: (costId, sub) => {
        const target = get().costs.find((c) => c.id === costId);
        if (!target) return null;
        const created: SubCost = {
          id: sub.id ?? nanoid(10),
          name: sub.name,
          money: sub.money,
          range: sub.range,
          kind: sub.kind,
          conversionMode: sub.conversionMode,
          tax: sub.tax,
          note: sub.note,
          url: sub.url,
          order: sub.order ?? target.subCosts.length,
          included: sub.included ?? true,
          maybe: sub.maybe ?? false,
          dueDate: sub.dueDate,
        };
        set((state) => ({
          costs: state.costs.map((c) =>
            c.id === costId
              ? {
                  ...c,
                  subCosts: [...c.subCosts, created],
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        }));
        return created;
      },

      updateSubCost: (costId, subCostId, patch) =>
        set((state) => ({
          costs: state.costs.map((c) =>
            c.id === costId
              ? {
                  ...c,
                  subCosts: c.subCosts.map((sc) =>
                    sc.id === subCostId ? { ...sc, ...patch } : sc
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      deleteSubCost: (costId, subCostId) =>
        set((state) => ({
          costs: state.costs.map((c) =>
            c.id === costId
              ? {
                  ...c,
                  subCosts: c.subCosts.filter((sc) => sc.id !== subCostId),
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      // Tasks
      addTask: (task) => {
        const now = new Date().toISOString();
        const created: Task = {
          id: task.id ?? nanoid(10),
          title: task.title,
          note: task.note,
          phaseId: task.phaseId,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          tags: task.tags ?? [],
          checklist: task.checklist ?? [],
          linkedCostId: task.linkedCostId,
          progress: task.progress,
          pinned: task.pinned ?? false,
          order: task.order ?? get().tasks.length,
          createdAt: task.createdAt ?? now,
          completedAt: task.completedAt,
        };
        set((state) => ({ tasks: [...state.tasks, created] }));
        return created;
      },

      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        })),

      reorderTasks: (orderedIds) =>
        set((state) => {
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            tasks: state.tasks
              .map((t) => ({ ...t, order: orderMap.get(t.id) ?? t.order }))
              .sort((a, b) => a.order - b.order),
          };
        }),

      linkCostToLender: (costId, lenderId) =>
        set((state) => linkCostToLender(pickAppData(state), costId, lenderId)),

      unlinkCost: (costId) =>
        set((state) => ({
          costs: state.costs.map((c) => (c.id === costId ? { ...c, lenderId: undefined } : c)),
        })),

      addExtra: (extra) => {
        const created: Extra = {
          ...extra,
          id: nanoid(10),
          order: (get().extras ?? []).length,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ extras: [...(state.extras ?? []), created] }));
        return created;
      },

      updateExtra: (id, patch) =>
        set((state) => ({
          extras: (state.extras ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteExtra: (id) =>
        set((state) => ({ extras: (state.extras ?? []).filter((e) => e.id !== id) })),

      receiveExtra: (id, accountId, amount, date) => {
        const extra = (get().extras ?? []).find((e) => e.id === id);
        if (!extra || !(amount > 0)) return;
        const tx = get().addTransaction({
          type: 'deposit',
          date,
          accountId,
          amount,
          note: extra.kind === 'sell' ? `Sold ${extra.name}` : `Received ${extra.name}`,
        });
        set((state) => ({
          extras: (state.extras ?? []).map((e) => (e.id === id ? { ...e, receivedTxId: tx.id } : e)),
        }));
      },

      unreceiveExtra: (id) =>
        set((state) => {
          const extra = (state.extras ?? []).find((e) => e.id === id);
          return {
            transactions: state.transactions.filter((t) => t.id !== extra?.receivedTxId),
            extras: (state.extras ?? []).map((e) => (e.id === id ? { ...e, receivedTxId: undefined } : e)),
          };
        }),

      setInheritance: (plan) =>
        set({ inheritance: plan ? { ...plan, updatedAt: new Date().toISOString() } : null }),

      // Seed, Export, Import, Reset
      loadStarterData: () => {
        const seeded = buildSeededAppData();
        set(seeded);
      },

      resetAllData: () => {
        const empty = buildEmptyAppData();
        set(empty);
      },

      exportJSON: () => {
        const state = get();
        return {
          ...pickAppData(state),
          exportedAt: new Date().toISOString(),
          schemaVersion: CURRENT_SCHEMA_VERSION,
        };
      },

      importJSON: (raw, mode = 'merge') => {
        if (!raw || typeof raw !== 'object') {
          return { ok: false, error: 'Invalid JSON payload' };
        }

        const current: AppData = pickAppData(get());

        // Full AppData shape?
        if (isValidAppData(raw)) {
          const migrated = migrate(raw, (raw.settings as Settings)?.schemaVersion ?? 1);
          if (mode === 'replace') {
            set(migrated);
          } else {
            const merged = mergeSeedIntoAppData(current, migrated as unknown as SeedFormatInput);
            set(merged);
          }
          return { ok: true };
        }

        // Seed format shape (e.g. docs/seed.json or private/my-data.json)
        const obj = raw as Record<string, unknown>;
        if (
          Array.isArray(obj.costs) ||
          Array.isArray(obj.accounts) ||
          Array.isArray(obj.tasks) ||
          typeof obj.inheritance === 'object' ||
          typeof obj.settings === 'object'
        ) {
          if (mode === 'replace') {
            const mapped = mapSeedToAppData(raw as SeedFormatInput, {
              ...current,
              settings: buildDefaultSettings(),
            });
            set(mapped);
          } else {
            const merged = mergeSeedIntoAppData(current, raw as SeedFormatInput);
            set(merged);
          }
          return { ok: true };
        }

        return { ok: false, error: 'Unrecognized JSON structure' };
      },
    }),
    {
      name: PERSIST_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => createDebouncedStorage(300)),
      partialize: (state): AppData => pickAppData(state),
      migrate: (persistedState, version) => migrate(persistedState, version),
      onRehydrateStorage: () => (state) => {
        if (state) {
          saveDailySnapshot(pickAppData(state));
        }
      },
    }
  )
);

// Keep loan costs that follow a person in step with what I took from them (also after import / sync / undo).
useStore.subscribe((state, prev) => {
  if (state.costs === prev.costs && state.accounts === prev.accounts && state.transactions === prev.transactions)
    return;
  const costs = syncLinkedLoanCosts(state);
  if (costs) useStore.setState({ costs });
});
