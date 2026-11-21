import {
  Account,
  AppData,
  Cost,
  CostVariant,
  Extra,
  Settings,
  SubCost,
  Transaction,
} from '../types';
import { getConversionContext, moneyToPkr, usdToPkr } from '../lib/currency';

export type CostStatus = 'paid' | 'partial' | 'due_soon' | 'overdue' | 'planned';

/**
 * `costSource(cost)`: `variants?.length ? activeVariant : cost`
 */
export function costSource(cost: Cost): Cost | CostVariant {
  if (cost.variants && cost.variants.length > 0) {
    const active = cost.variants.find((v) => v.id === cost.activeVariantId);
    return active ?? cost.variants[0];
  }
  return cost;
}

export function isCostExpired(cost: Cost, todayIso = new Date().toISOString().slice(0, 10)): boolean {
  if (!cost.temporary?.end) return false;
  return cost.temporary.end < todayIso;
}

/**
 * `costOccurrenceTotal(cost)` in PKR:
 * `src = costSource(cost)`; `src.subCosts.length ? Σ(included && !maybe subCosts → PKR) : src.money → PKR`
 */
export function costOccurrenceTotal(
  cost: Cost,
  settings: Settings,
  modeOverride?: 'market' | 'effective' | 'detailed'
): number {
  const ctx = getConversionContext(settings);
  const src = costSource(cost);
  if (src.subCosts && src.subCosts.length > 0) {
    return src.subCosts
      .filter((sc) => sc.included && !sc.maybe)
      .reduce(
        (sum, sc) =>
          sum +
          moneyToPkr(
            sc.money,
            ctx,
            modeOverride ?? sc.conversionMode ?? cost.conversionMode,
            sc.tax ?? cost.tax
          ),
        0
      );
  }
  return moneyToPkr(
    src.money,
    ctx,
    modeOverride ?? cost.conversionMode,
    cost.tax
  );
}

/**
 * `costMaybeExtra(cost)` in PKR:
 * Σ of included sub-costs with `maybe:true` (multiplied by occurrences if recurring)
 */
export function costMaybeExtra(
  cost: Cost,
  settings: Settings,
  modeOverride?: 'market' | 'effective' | 'detailed'
): number {
  const ctx = getConversionContext(settings);
  const src = costSource(cost);
  if (!src.subCosts || src.subCosts.length === 0) return 0;
  const occ = cost.recurrence?.occurrences ?? 1;
  const perOcc = src.subCosts
    .filter((sc) => sc.included && sc.maybe)
    .reduce(
      (sum, sc) =>
        sum +
        moneyToPkr(
          sc.money,
          ctx,
          modeOverride ?? sc.conversionMode ?? cost.conversionMode,
          sc.tax ?? cost.tax
        ),
      0
    );
  return perOcc * occ;
}

/**
 * `costTotal(cost)` in PKR: occurrence total × (recurrence?.occurrences ?? 1)
 */
export function costTotal(
  cost: Cost,
  settings: Settings,
  modeOverride?: 'market' | 'effective' | 'detailed'
): number {
  const occ = cost.recurrence?.occurrences ?? 1;
  return costOccurrenceTotal(cost, settings, modeOverride) * occ;
}

export function costMarketPkr(cost: Cost, settings: Settings): number {
  return costTotal(cost, settings, 'market');
}

export function costEffectivePkr(cost: Cost, settings: Settings): number {
  return costTotal(cost, settings, 'effective');
}

export function costNativeUsd(cost: Cost): number | null {
  const src = costSource(cost);
  const occ = cost.recurrence?.occurrences ?? 1;
  if (src.subCosts && src.subCosts.length > 0) {
    const activeSubs = src.subCosts.filter((sc) => sc.included && !sc.maybe);
    if (activeSubs.length > 0 && activeSubs.every((sc) => sc.money.currency === 'USD')) {
      return activeSubs.reduce((s, sc) => s + sc.money.amount, 0) * occ;
    }
    return null;
  }
  if (src.money.currency === 'USD') {
    return src.money.amount * occ;
  }
  return null;
}

export function selectPlanTotalMarketPkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  const active = getActivePlanCosts(data.costs, todayIso);
  let sum = 0;
  for (const c of active) {
    if (!c.maybe) sum += costTotal(c, data.settings, 'market');
    else if (includeMaybes) sum += costTotal(c, data.settings, 'market');
    if (includeMaybes) sum += costMaybeExtra(c, data.settings, 'market');
  }
  return sum;
}

export function selectPlanTotalEffectivePkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  const active = getActivePlanCosts(data.costs, todayIso);
  let sum = 0;
  for (const c of active) {
    if (!c.maybe) sum += costTotal(c, data.settings, 'effective');
    else if (includeMaybes) sum += costTotal(c, data.settings, 'effective');
    if (includeMaybes) sum += costMaybeExtra(c, data.settings, 'effective');
  }
  return sum;
}

export function subCostTotalPkr(cost: Cost, sub: SubCost, settings: Settings): number {
  const ctx = getConversionContext(settings);
  return moneyToPkr(
    sub.money,
    ctx,
    sub.conversionMode ?? cost.conversionMode,
    sub.tax ?? cost.tax
  );
}

/**
 * `costPaid(cost)` in PKR (§4 & §5.4):
 * If payment is from a USD account to a USD cost, payment counts against the cost in native USD
 * (clears at cost's own conversion mode, no card tax discrepancy).
 */
export function costPaid(
  cost: Cost,
  transactions: Transaction[],
  accounts: Account[],
  settings: Settings
): number {
  const ctx = getConversionContext(settings);
  const src = costSource(cost);
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const payments = transactions.filter((t) => t.type === 'payment' && t.costId === cost.id);

  let totalPkr = 0;
  for (const p of payments) {
    const acc = accMap.get(p.accountId);
    const accCurr = acc?.currency ?? 'PKR';
    if (accCurr === 'PKR') {
      totalPkr += p.amount;
    } else {
      // USD account paying a cost: if cost is in USD, convert at cost's own mode so $X clears $X of cost
      if (src.money.currency === 'USD') {
        totalPkr += moneyToPkr(
          { amount: p.amount, currency: 'USD' },
          ctx,
          cost.conversionMode,
          cost.tax
        );
      } else {
        totalPkr += usdToPkr(
          p.amount,
          'effective',
          settings.rates.market,
          settings.rates.effective
        );
      }
    }
  }
  // v6: a loan cost linked to a person — paying that person back is paying this cost
  const lender = cost.lenderId ? accMap.get(cost.lenderId) : undefined;
  if (lender && isLender(lender)) {
    const repaid = lenderStats(lender, transactions).repaid;
    totalPkr += moneyToPkr({ amount: repaid, currency: lender.currency }, ctx, cost.conversionMode, cost.tax);
  }
  return totalPkr;
}

/**
 * `costStatus(cost)`:
 * `paid >= total` -> 'paid'; `paid > 0` -> 'partial'; due <= 14 days -> 'due_soon'; past due -> 'overdue'; else 'planned'
 */
export function costStatus(
  cost: Cost,
  transactions: Transaction[],
  accounts: Account[],
  settings: Settings,
  todayIso = new Date().toISOString().slice(0, 10)
): CostStatus {
  const total = costTotal(cost, settings);
  const paid = costPaid(cost, transactions, accounts, settings);
  if (total > 0 && paid >= total - 0.5) return 'paid';
  if (paid > 0) return 'partial';

  const due = costNextDue(cost);
  if (due) {
    if (due < todayIso) return 'overdue';
    const diffMs = Date.parse(due) - Date.parse(todayIso);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 14) return 'due_soon';
  }
  return 'planned';
}

/**
 * Earliest due date of a cost: its own date or any counted item's date (items can be due separately).
 */
export function costNextDue(cost: Cost): string | undefined {
  const dates = [
    cost.dueDate,
    ...costSource(cost)
      .subCosts.filter((s) => s.included && !s.maybe)
      .map((s) => s.dueDate),
  ].filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort()[0] : undefined;
}

/**
 * A cost split by when its money is due (PKR, at the cost's conversion): counted items with their own
 * date are separate parts; everything else falls on the cost's due date (or undefined = unscheduled).
 */
export function costDueParts(cost: Cost, settings: Settings): { date?: string; pkr: number }[] {
  const total = costTotal(cost, settings);
  const occ = cost.recurrence?.occurrences ?? 1;
  const dated = costSource(cost).subCosts.filter((s) => s.included && !s.maybe && s.dueDate);
  const parts = dated.map((s) => ({ date: s.dueDate, pkr: subCostTotalPkr(cost, s, settings) * occ }));
  const rest = total - parts.reduce((a, p) => a + p.pkr, 0);
  if (rest > 0.5 || parts.length === 0) parts.push({ date: cost.dueDate, pkr: Math.max(0, rest) });
  return parts;
}

/**
 * `accountBalance(acc)` in account's native currency:
 * opening + deposits − withdrawals − payments ± transfers
 */
export function accountBalance(acc: Account, transactions: Transaction[]): number {
  let bal = acc.openingBalance;
  for (const tx of transactions) {
    if (tx.type === 'deposit' && tx.accountId === acc.id) {
      bal += tx.amount;
    } else if (
      (tx.type === 'withdrawal' || tx.type === 'payment') &&
      tx.accountId === acc.id
    ) {
      bal -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === acc.id) {
        bal -= tx.amount;
      }
      if (tx.toAccountId === acc.id) {
        bal += tx.toAmount ?? tx.amount;
      }
    }
  }
  return bal;
}

/**
 * Value of an account in PKR (§5.4):
 * - PKR accounts: native
 * - USD accounts: `usd * M` (holding real dollars -> market rate)
 */
export function accountBalancePkr(
  acc: Account,
  transactions: Transaction[],
  settings: Settings
): number {
  const native = accountBalance(acc, transactions);
  if (acc.currency === 'PKR') return native;
  return native * settings.rates.market;
}

export function accountReservedPkr(acc: Account, settings: Settings): number {
  const res = acc.reserved ?? 0;
  if (acc.currency === 'PKR') return res;
  return res * settings.rates.market;
}

/** v5: a person I borrowed from (their balance is negative while I owe them). */
export function isLender(acc: Account): boolean {
  return acc.role === 'lender';
}

/** My own money that counts toward the plan: funding role, included, not archived. */
function countsAsMyMoney(acc: Account): boolean {
  return !isLender(acc) && acc.includeInTotals && !acc.archived;
}

/**
 * `totalFunds` in PKR:
 * Σ balances of my funding accounts with `includeInTotals && !archived`, minus `reserved`
 */
export function selectTotalFundsPkr(data: AppData): number {
  return data.accounts.filter(countsAsMyMoney).reduce((sum, a) => {
    const bal = accountBalancePkr(a, data.transactions, data.settings);
    const res = accountReservedPkr(a, data.settings);
    return sum + (bal - res);
  }, 0);
}

export function selectTotalGrossFundsPkr(data: AppData): number {
  return data.accounts
    .filter(countsAsMyMoney)
    .reduce((sum, a) => sum + accountBalancePkr(a, data.transactions, data.settings), 0);
}

export function selectTotalReservedPkr(data: AppData): number {
  return data.accounts
    .filter(countsAsMyMoney)
    .reduce((sum, a) => sum + accountReservedPkr(a, data.settings), 0);
}

// ── People I owe (lender accounts) ────────────────────────────────────────────
export interface LenderStats {
  borrowed: number; // everything taken from them (lender currency)
  repaid: number; // everything paid back
  owed: number; // borrowed − repaid (negative = I overpaid)
}

/** Totals for one lender, in the lender's currency. owed === −accountBalance. */
export function lenderStats(acc: Account, transactions: Transaction[]): LenderStats {
  let borrowed = Math.max(0, -acc.openingBalance);
  let repaid = Math.max(0, acc.openingBalance);
  for (const tx of transactions) {
    if (tx.accountId === acc.id && (tx.type === 'payment' || tx.type === 'withdrawal' || tx.type === 'transfer')) {
      borrowed += tx.amount;
    } else if (tx.type === 'transfer' && tx.toAccountId === acc.id) {
      repaid += tx.toAmount ?? tx.amount;
    } else if (tx.type === 'deposit' && tx.accountId === acc.id) {
      repaid += tx.amount;
    }
  }
  return { borrowed, repaid, owed: borrowed - repaid };
}

export function lenderOwedPkr(acc: Account, transactions: Transaction[], settings: Settings): number {
  const owed = Math.max(0, lenderStats(acc, transactions).owed);
  return acc.currency === 'PKR' ? owed : owed * settings.rates.market;
}

/** The plan cost a person is linked to (v6), if any. */
export function linkedCostFor(lenderId: string, costs: Cost[]): Cost | undefined {
  return costs.find((c) => c.lenderId === lenderId);
}

/** A linked person's debt is already in "Left to pay" when their cost is a counted (non-maybe) plan cost. */
function debtCountedInPlan(lender: Account, data: AppData, todayIso: string): boolean {
  const c = linkedCostFor(lender.id, data.costs);
  return !!c && !c.maybe && getActivePlanCosts([c], todayIso).length === 1;
}

/**
 * Σ still owed to people (PKR). This has to come out of my money, so it lowers the spare.
 * By default people whose loan is already a plan cost are left out (it's in "Left to pay" instead);
 * `all: true` gives everything I owe.
 */
export function selectTotalOwedPkr(
  data: AppData,
  opts: { all?: boolean; todayIso?: string } = {}
): number {
  const today = opts.todayIso ?? new Date().toISOString().slice(0, 10);
  return data.accounts
    .filter((a) => isLender(a) && !a.archived && (opts.all || !debtCountedInPlan(a, data, today)))
    .reduce((sum, a) => sum + lenderOwedPkr(a, data.transactions, data.settings), 0);
}

/** My money once every debt to people is repaid. */
export function selectNetFundsPkr(data: AppData): number {
  return selectTotalFundsPkr(data) - selectTotalOwedPkr(data);
}

export type LenderEventKind = 'paid_cost' | 'gave_cash' | 'other' | 'repaid' | 'opening';
export interface LenderEvent {
  id: string;
  kind: LenderEventKind;
  date: string;
  amount: number; // lender currency, always positive
  costId?: string;
  otherAccountId?: string; // my account the cash went to / the repayment came from
  note?: string;
  tx?: Transaction;
}

/** A lender's history, newest first. */
export function lenderHistory(acc: Account, transactions: Transaction[]): LenderEvent[] {
  const out: LenderEvent[] = [];
  for (const tx of transactions) {
    const base = { id: tx.id, date: tx.date, note: tx.note, tx };
    if (tx.accountId === acc.id) {
      if (tx.type === 'payment') out.push({ ...base, kind: 'paid_cost', amount: tx.amount, costId: tx.costId });
      else if (tx.type === 'transfer')
        out.push({ ...base, kind: 'gave_cash', amount: tx.amount, otherAccountId: tx.toAccountId });
      else if (tx.type === 'withdrawal') out.push({ ...base, kind: 'other', amount: tx.amount });
      else if (tx.type === 'deposit') out.push({ ...base, kind: 'repaid', amount: tx.amount });
    } else if (tx.type === 'transfer' && tx.toAccountId === acc.id) {
      out.push({ ...base, kind: 'repaid', amount: tx.toAmount ?? tx.amount, otherAccountId: tx.accountId });
    }
  }
  out.sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (b.tx?.createdAt ?? '').localeCompare(a.tx?.createdAt ?? '')));
  if (acc.openingBalance < 0) {
    out.push({ id: `${acc.id}-opening`, kind: 'opening', date: acc.createdAt.slice(0, 10), amount: -acc.openingBalance });
  }
  return out;
}

/**
 * §5.4 Spending power (USD) = USD accounts (available) + PKR accounts (available) / E
 */
export function selectSpendingPowerUsd(data: AppData): {
  spendingPowerUsd: number;
  realUsdHeld: number;
  pkrAvailable: number;
} {
  const E = data.settings.rates.effective > 0 ? data.settings.rates.effective : 300;
  let realUsdHeld = 0;
  let pkrAvailable = 0;

  for (const a of data.accounts) {
    if (!countsAsMyMoney(a)) continue;
    const avail = accountBalance(a, data.transactions) - (a.reserved ?? 0);
    if (a.currency === 'USD') {
      realUsdHeld += avail;
    } else {
      pkrAvailable += avail;
    }
  }

  return {
    spendingPowerUsd: realUsdHeld + pkrAvailable / E,
    realUsdHeld,
    pkrAvailable,
  };
}

/**
 * Active plan costs filter: `included && !archived && !expired`
 */
export function getActivePlanCosts(
  costs: Cost[],
  todayIso = new Date().toISOString().slice(0, 10)
): Cost[] {
  return costs.filter((c) => c.included && !c.archived && !isCostExpired(c, todayIso));
}

/**
 * `planTotal` (confirmed) in PKR:
 * Σ `costTotal` for `included && !archived && !expired && !maybe`
 */
export function selectPlanTotalPkr(
  data: AppData,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  return getActivePlanCosts(data.costs, todayIso)
    .filter((c) => !c.maybe)
    .reduce((sum, c) => sum + costTotal(c, data.settings), 0);
}

/**
 * `maybeTotal` in PKR:
 * Σ `costTotal` of `maybe` costs + Σ `costMaybeExtra` of all active costs
 */
export function selectMaybeTotalPkr(
  data: AppData,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  const active = getActivePlanCosts(data.costs, todayIso);
  let total = 0;
  for (const c of active) {
    if (c.maybe) {
      total += costTotal(c, data.settings) + costMaybeExtra(c, data.settings);
    } else {
      total += costMaybeExtra(c, data.settings);
    }
  }
  return total;
}

export function selectPlanWithMaybesPkr(
  data: AppData,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  return selectPlanTotalPkr(data, todayIso) + selectMaybeTotalPkr(data, todayIso);
}

export function selectTotalPaidPkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  return getActivePlanCosts(data.costs, todayIso)
    .filter((c) => includeMaybes || !c.maybe)
    .reduce(
      (sum, c) =>
        sum + costPaid(c, data.transactions, data.accounts, data.settings),
      0
    );
}

export function selectRemainingPkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  const plan = includeMaybes
    ? selectPlanWithMaybesPkr(data, todayIso)
    : selectPlanTotalPkr(data, todayIso);
  const paid = selectTotalPaidPkr(data, includeMaybes, todayIso);
  return Math.max(0, plan - paid);
}

export function selectGapPkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  // money I owe people still has to come out of my funds
  const funds = selectNetFundsPkr(data);
  const rem = selectRemainingPkr(data, includeMaybes, todayIso);
  return funds - rem;
}

export function selectCoveragePercent(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): number {
  const plan = includeMaybes
    ? selectPlanWithMaybesPkr(data, todayIso)
    : selectPlanTotalPkr(data, todayIso);
  if (plan <= 0) return 100;
  const paid = selectTotalPaidPkr(data, includeMaybes, todayIso);
  const funds = selectNetFundsPkr(data);
  return ((paid + funds) / plan) * 100;
}

/**
 * `range`: Σ low / Σ high for estimates (fixed costs count same in both)
 */
export function selectPlanRangePkr(
  data: AppData,
  includeMaybes = false,
  todayIso = new Date().toISOString().slice(0, 10)
): { lowPkr: number; highPkr: number; hasRange: boolean } {
  const ctx = getConversionContext(data.settings);
  const active = getActivePlanCosts(data.costs, todayIso).filter(
    (c) => includeMaybes || !c.maybe
  );

  let lowPkr = 0;
  let highPkr = 0;
  let hasRange = false;

  for (const c of active) {
    const src = costSource(c);
    const occ = c.recurrence?.occurrences ?? 1;
    const base = costTotal(c, data.settings);
    if (src.range && src.subCosts.length === 0) {
      hasRange = true;
      const lowM = moneyToPkr(
        { amount: src.range.low, currency: src.money.currency },
        ctx,
        c.conversionMode,
        c.tax
      );
      const highM = moneyToPkr(
        { amount: src.range.high, currency: src.money.currency },
        ctx,
        c.conversionMode,
        c.tax
      );
      lowPkr += lowM * occ;
      highPkr += highM * occ;
    } else {
      lowPkr += base;
      highPkr += base;
    }
    if (includeMaybes && !c.maybe) {
      const extra = costMaybeExtra(c, data.settings);
      lowPkr += extra;
      highPkr += extra;
    }
  }

  return { lowPkr, highPkr, hasRange };
}

/**
 * Ledger rows for an account with running balance (oldest -> newest, returned newest first)
 */
export interface LedgerRow {
  tx: Transaction;
  signedAmount: number;
  runningBalance: number;
}

export function buildAccountLedger(
  acc: Account,
  transactions: Transaction[]
): LedgerRow[] {
  const relevant = transactions
    .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

  let running = acc.openingBalance;
  const rows: LedgerRow[] = [];

  for (const tx of relevant) {
    let delta = 0;
    if (tx.type === 'deposit' && tx.accountId === acc.id) {
      delta = tx.amount;
    } else if (
      (tx.type === 'withdrawal' || tx.type === 'payment') &&
      tx.accountId === acc.id
    ) {
      delta = -tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === acc.id) {
        delta = -tx.amount;
      } else if (tx.toAccountId === acc.id) {
        delta = tx.toAmount ?? tx.amount;
      }
    }
    running += delta;
    rows.push({
      tx,
      signedAmount: delta,
      runningBalance: running,
    });
  }

  return rows.reverse();
}

// ── Extras: things I could sell / money I expect (v6) ───────────────────────
/** An extra counts as received only while its deposit still exists. */
export function extraReceived(extra: Extra, transactions: Transaction[]): boolean {
  return !!extra.receivedTxId && transactions.some((t) => t.id === extra.receivedTxId);
}

/** Real money coming in → dollars at the market rate. */
export function extraPkr(extra: Extra, settings: Settings): number {
  return extra.money.currency === 'PKR' ? extra.money.amount : extra.money.amount * settings.rates.market;
}

export interface ExtrasSummary {
  sure: number;
  likely: number;
  maybe: number;
  total: number;
  count: number;
}

/** Pending extras in PKR, by chance. */
export function selectExtrasPkr(data: AppData): ExtrasSummary {
  const out: ExtrasSummary = { sure: 0, likely: 0, maybe: 0, total: 0, count: 0 };
  for (const e of data.extras ?? []) {
    if (extraReceived(e, data.transactions)) continue;
    const v = extraPkr(e, data.settings);
    out[e.chance] += v;
    out.total += v;
    out.count += 1;
  }
  return out;
}
