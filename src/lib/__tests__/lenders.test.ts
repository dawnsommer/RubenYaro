import { describe, it, expect } from 'vitest';
import { buildEmptyAppData } from '../../store/seed';
import { migrate } from '../../store/migrations';
import {
  accountBalance,
  costPaid,
  lenderHistory,
  lenderStats,
  selectGapPkr,
  selectNetFundsPkr,
  selectRemainingPkr,
  selectTotalFundsPkr,
  selectTotalOwedPkr,
  selectTotalPaidPkr,
} from '../../store/selectors';
import { Account, AppData, Cost, Transaction } from '../../types';

const now = '2026-11-01T00:00:00.000Z';
const acc = (p: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  kind: 'bank',
  currency: 'PKR',
  openingBalance: 0,
  color: '#000',
  icon: 'Wallet',
  includeInTotals: true,
  archived: false,
  order: 0,
  createdAt: now,
  ...p,
});
const tx = (
  p: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'accountId' | 'amount'>
): Transaction => ({
  date: '2026-11-10',
  createdAt: now,
  ...p,
});

function world(): AppData {
  const data = buildEmptyAppData();
  const fee: Cost = {
    id: 'fee',
    name: 'Step 1 fee',
    money: { amount: 300_000, currency: 'PKR' },
    kind: 'fixed',
    categoryId: 'exam',
    phaseId: 'step1',
    priority: 'must',
    subCosts: [],
    maybe: false,
    included: true,
    archived: false,
    order: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  data.costs = [fee];
  data.accounts = [
    acc({ id: 'bank', name: 'Main bank', openingBalance: 1_000_000 }),
    acc({ id: 'ali', name: 'Ali', role: 'lender' }),
  ];
  return data;
}

describe('people I owe (lender accounts, v5)', () => {
  it('a friend paying a cost: cost is paid, my money untouched, I owe him', () => {
    const d = world();
    d.transactions = [tx({ id: 't1', type: 'payment', accountId: 'ali', costId: 'fee', amount: 300_000 })];
    expect(costPaid(d.costs[0], d.transactions, d.accounts, d.settings)).toBe(300_000);
    expect(selectTotalPaidPkr(d)).toBe(300_000);
    expect(selectRemainingPkr(d)).toBe(0);
    expect(selectTotalFundsPkr(d)).toBe(1_000_000); // lender is never "my money"
    expect(selectTotalOwedPkr(d)).toBe(300_000);
    // spare = money − left to pay − owed: borrowing doesn't make me richer
    expect(selectGapPkr(d)).toBe(700_000);
  });

  it('repaying in parts lowers both my money and what I owe; spare stays the same', () => {
    const d = world();
    d.transactions = [
      tx({ id: 't1', type: 'payment', accountId: 'ali', costId: 'fee', amount: 300_000 }),
      tx({
        id: 't2',
        type: 'transfer',
        accountId: 'bank',
        toAccountId: 'ali',
        amount: 100_000,
        date: '2026-11-20',
      }),
      tx({
        id: 't3',
        type: 'transfer',
        accountId: 'bank',
        toAccountId: 'ali',
        amount: 50_000,
        date: '2026-11-25',
      }),
    ];
    const s = lenderStats(d.accounts[1], d.transactions);
    expect(s).toEqual({ borrowed: 300_000, repaid: 150_000, owed: 150_000 });
    expect(accountBalance(d.accounts[1], d.transactions)).toBe(-150_000);
    expect(selectTotalFundsPkr(d)).toBe(850_000);
    expect(selectTotalOwedPkr(d)).toBe(150_000);
    expect(selectNetFundsPkr(d)).toBe(700_000);
    expect(selectGapPkr(d)).toBe(700_000);
    expect(lenderHistory(d.accounts[1], d.transactions).map((e) => e.kind)).toEqual([
      'repaid',
      'repaid',
      'paid_cost',
    ]);
  });

  it('cash borrowed into my account, and an opening debt', () => {
    const d = world();
    d.accounts[1] = { ...d.accounts[1], openingBalance: -20_000 };
    d.transactions = [
      tx({ id: 't1', type: 'transfer', accountId: 'ali', toAccountId: 'bank', amount: 80_000 }),
    ];
    expect(selectTotalFundsPkr(d)).toBe(1_080_000);
    expect(lenderStats(d.accounts[1], d.transactions)).toEqual({
      borrowed: 100_000,
      repaid: 0,
      owed: 100_000,
    });
    expect(selectNetFundsPkr(d)).toBe(980_000);
    const h = lenderHistory(d.accounts[1], d.transactions);
    expect(h.map((e) => e.kind)).toEqual(['gave_cash', 'opening']);
  });

  it('overpaying never counts as negative debt in the totals', () => {
    const d = world();
    d.transactions = [
      tx({ id: 't1', type: 'transfer', accountId: 'bank', toAccountId: 'ali', amount: 5_000 }),
    ];
    expect(lenderStats(d.accounts[1], d.transactions).owed).toBe(-5_000);
    expect(selectTotalOwedPkr(d)).toBe(0);
  });

  it('migration v5 gives old accounts the funding role', () => {
    const d = world();
    const old = { ...d, accounts: [{ ...d.accounts[0], role: undefined }, d.accounts[1]] };
    const m = migrate(old, 4);
    expect(m.accounts.map((a) => a.role)).toEqual(['funding', 'lender']);
  });
});
