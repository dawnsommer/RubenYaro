import { AppData, Cost } from '../types';
import { isLender, lenderStats } from './selectors';

/**
 * Loan costs ↔ people I owe (v6).
 * A linked cost's amount always equals what I took from that person (in their currency), and repaying the
 * person counts as paying the cost (see `costPaid`). The person's debt then sits in "Left to pay" instead of
 * being taken off the spare separately (see `selectTotalOwedPkr`).
 */

/** Only plain costs can follow a person: no items, options or repeats. */
export function canLinkCost(cost: Cost): boolean {
  return !cost.subCosts.length && !cost.variants?.length && !cost.recurrence;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Linked costs whose amount is out of date (or whose person is gone), fixed. null = nothing to change. */
export function syncLinkedLoanCosts(
  data: Pick<AppData, 'costs' | 'accounts' | 'transactions'>
): Cost[] | null {
  let changed = false;
  const costs = data.costs.map((c) => {
    if (!c.lenderId) return c;
    const lender = data.accounts.find((a) => a.id === c.lenderId);
    if (!lender || !isLender(lender) || !canLinkCost(c)) {
      changed = true;
      return { ...c, lenderId: undefined };
    }
    const amount = round2(lenderStats(lender, data.transactions).borrowed);
    if (c.money.amount === amount && c.money.currency === lender.currency) return c;
    changed = true;
    return { ...c, money: { amount, currency: lender.currency } };
  });
  return changed ? costs : null;
}

/**
 * Link a cost to a person. If the person has nothing recorded yet, the cost's amount becomes what I already
 * owe them. Payments I'd recorded on the cost become repayments to that person (same money, now in one place).
 */
export function linkCostToLender(
  data: AppData,
  costId: string,
  lenderId: string
): Pick<AppData, 'costs' | 'accounts' | 'transactions'> {
  const cost = data.costs.find((c) => c.id === costId);
  const lender = data.accounts.find((a) => a.id === lenderId);
  if (!cost || !lender || !isLender(lender) || !canLinkCost(cost)) {
    return { costs: data.costs, accounts: data.accounts, transactions: data.transactions };
  }
  const m = data.settings.rates.market || 280;

  let accounts = data.accounts;
  if (lenderStats(lender, data.transactions).borrowed <= 0.5 && cost.money.amount > 0) {
    accounts = accounts.map((a) =>
      a.id === lenderId ? { ...a, currency: cost.money.currency, openingBalance: -cost.money.amount } : a
    );
  }
  const lenderCur = accounts.find((a) => a.id === lenderId)!.currency;

  const transactions = data.transactions.map((t) => {
    if (t.type !== 'payment' || t.costId !== costId) return t;
    const from = accounts.find((a) => a.id === t.accountId);
    if (!from || isLender(from)) return t;
    const toAmount =
      from.currency === lenderCur ? t.amount : from.currency === 'USD' ? t.amount * m : round2(t.amount / m);
    return {
      ...t,
      type: 'transfer' as const,
      toAccountId: lenderId,
      toAmount,
      costId: undefined,
      subCostId: undefined,
      note: t.note || `Repaid ${lender.name}`,
    };
  });

  const costs = data.costs.map((c) => {
    if (c.id === costId) return { ...c, lenderId, updatedAt: new Date().toISOString() };
    if (c.lenderId === lenderId) return { ...c, lenderId: undefined }; // one cost per person
    return c;
  });

  const next = { costs, accounts, transactions };
  return { ...next, costs: syncLinkedLoanCosts(next) ?? costs };
}
