export type Currency = 'USD' | 'PKR';
export type ConversionMode = 'market' | 'effective' | 'detailed';
//  market    = USD × live/manual market rate
//  effective = USD × flat "after-tax card rate" (default 300)
//  detailed  = USD × market rate + tax (% or fixed PKR)

export interface Money { amount: number; currency: Currency }   // stored as entered, never pre-converted

export interface TaxRule { kind: 'percent' | 'fixed'; value: number } // fixed is in PKR

export interface Settings {
  schemaVersion: number;                 // start at 1; bump + migrate on change
  displayCurrency: Currency;             // primary currency in UI
  rates: {
    market: number;                      // PKR per 1 USD
    marketSource: 'auto' | 'manual';
    marketUpdatedAt: string | null;      // ISO
    marketProvider: string | null;       // e.g. 'open.er-api.com'
    effective: number;                   // default 300
  };
  defaultConversionMode: ConversionMode; // default 'effective'
  defaultTax: TaxRule;                   // default { kind:'percent', value: 0 } – user fills
  theme: 'system' | 'light' | 'dark';
  privacyMode: boolean;                  // blur all amounts
  journey: { targetDate: string | null; examDates: KeyDate[] };
  categories: Category[];
  phases: Phase[];
}

export interface Category { id: string; name: string; color: string; icon: string } // icon = lucide name
export interface Phase    { id: string; name: string; order: number; color: string }  // Step 1, Step 2 CK, ...

export interface Account {
  id: string; name: string;
  kind: 'bank' | 'cash' | 'card' | 'wallet' | 'foreign' | 'other';
  currency: Currency;
  openingBalance: number;                // in account currency
  color: string; icon: string; note?: string;
  includeInTotals: boolean;              // e.g. exclude an emergency fund
  reserved?: number;                     // amount earmarked "do not touch" (account currency)
  archived: boolean; order: number; createdAt: string;
}

export type TxnType = 'deposit' | 'withdrawal' | 'transfer' | 'payment';
export interface Transaction {
  id: string; type: TxnType; date: string;  // ISO date
  accountId: string;                         // source (or target for deposit)
  toAccountId?: string;                      // transfer only
  amount: number;                            // in source account currency
  toAmount?: number;                         // transfer across currencies (user-entered or auto at market)
  costId?: string; subCostId?: string;       // payment only
  note?: string; createdAt: string;
}

export type CostKind = 'fixed' | 'estimate';
export type Priority = 'must' | 'should' | 'nice';

export interface Recurrence {               // e.g. Qbank monthly subscription
  frequency: 'weekly' | 'monthly' | 'yearly';
  interval: number;                          // every N
  occurrences: number;                       // total count
  startDate: string;
}

export interface CostItemBase {
  id: string; name: string;
  money: Money;                              // per-occurrence amount
  range?: { low: number; high: number };     // optional, same currency as money (estimates)
  kind: CostKind;
  conversionMode?: ConversionMode;           // overrides settings.defaultConversionMode
  tax?: TaxRule;                             // overrides settings.defaultTax (detailed mode only)
  note?: string; url?: string;
}

export interface SubCost extends CostItemBase { order: number; included: boolean; maybe: boolean }

// Alternative ways to pay for the same thing, only ONE active (e.g. Flights: "Round trip" vs "Separate one-ways")
export interface CostVariant {
  id: string; name: string;
  money: Money; range?: { low: number; high: number };
  subCosts: SubCost[];                         // same Σ rule as Cost
  note?: string;
}

export interface Cost extends CostItemBase {
  categoryId: string; phaseId: string; priority: Priority;
  dueDate?: string;
  temporary?: { start: string; end: string };  // only counts in plan inside window; auto-flag "expired"
  recurrence?: Recurrence;
  subCosts: SubCost[];                         // if non-empty → parent total = Σ included sub-costs
  variants?: CostVariant[];                    // if present → cost total = active variant total (money/subCosts on Cost ignored)
  activeVariantId?: string;
  maybe: boolean;                              // uncertain cost ("maybe"): counted separately (see selectors)
  included: boolean;                           // toggle in/out of plan (what-if)
  archived: boolean; order: number; tags: string[];
  verify?: boolean;                            // seeded placeholder: show "verify price" chip
  createdAt: string; updatedAt: string;
}

export type TaskStatus = 'todo' | 'doing' | 'done';
export interface Task {
  id: string; title: string; note?: string;
  phaseId?: string; status: TaskStatus; priority: Priority;
  dueDate?: string; tags: string[];
  checklist: { id: string; text: string; done: boolean }[];
  linkedCostId?: string;                    // e.g. "Pay Step 1 fee" ↔ cost
  progress?: { current: number; total: number; unit: string }; // e.g. 1200/3600 questions
  pinned?: boolean;                         // pinned to top of Dashboard & Tasks
  order: number; createdAt: string; completedAt?: string;
}

export interface KeyDate { id: string; label: string; date: string; kind: 'exam' | 'deadline' | 'eligibility' | 'other' }

export interface AppData {
  settings: Settings; accounts: Account[]; transactions: Transaction[];
  costs: Cost[]; tasks: Task[];
}
