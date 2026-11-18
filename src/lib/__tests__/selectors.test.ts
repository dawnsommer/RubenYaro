import { describe, it, expect } from 'vitest';
import { buildSeededAppData, mergeSeedIntoAppData } from '../../store/seed';
import {
  accountBalance,
  costMaybeExtra,
  costPaid,
  costStatus,
  costTotal,
  selectGapPkr,
  selectMaybeTotalPkr,
  selectPlanTotalPkr,
  selectPlanWithMaybesPkr,
  selectSpendingPowerUsd,
  selectTotalFundsPkr,
} from '../../store/selectors';

describe('selectors (§4 & §5.4)', () => {
  it('computes seeded journey plan totals accurately at card rate 300', () => {
    const data = buildSeededAppData();
    // Seeded confirmed costs at 300:
    // ECFMG Pathways $950 -> 285k
    // ECFMG Cert $580 -> 174k
    // Step 3 $955 -> 286.5k
    // Match $2430 -> 729k
    // Flights (Round trip) -> 600k
    // 5-month stay $1200 * 5 -> 1,800k
    // Research (30k + 50k sub-costs) -> 80k
    // Interview room setup -> 50k
    // Visa Interview (50k + 10k sub-costs) -> 60k
    // Total confirmed in seed.json = 4,064,500 PKR
    expect(selectPlanTotalPkr(data)).toBe(4_064_500);

    // Seeded maybe: Observership $500 -> 150,000 PKR
    expect(selectMaybeTotalPkr(data)).toBe(150_000);
    expect(selectPlanWithMaybesPkr(data)).toBe(4_214_500);
  });

  it('matches D13 sanity check when merged with synthetic test obligations & maybes (+ Visa Interview 60k)', () => {
    const base = buildSeededAppData();
    const merged = mergeSeedIntoAppData(base, {
      accounts: [
        {
          name: 'Test savings',
          kind: 'bank',
          currency: 'PKR',
          openingBalance: 4_800_000,
        },
      ],
      costs: [
        {
          name: 'Loan A',
          phase: 'obligations',
          category: 'loans',
          money: { amount: 200_000, currency: 'PKR' },
        },
        {
          name: 'Loan B',
          phase: 'obligations',
          category: 'loans',
          money: { amount: 85_000, currency: 'PKR' },
        },
        {
          name: 'Obligation C',
          phase: 'obligations',
          category: 'loans',
          money: { amount: 57_000, currency: 'PKR' },
          subCosts: [
            { name: 'Base part', money: { amount: 57_000, currency: 'PKR' } },
            { name: 'Extra part', money: { amount: 36_000, currency: 'PKR' }, maybe: true },
          ],
        },
        {
          name: 'Optional device',
          phase: 'general',
          category: 'setup',
          money: { amount: 900, currency: 'USD' },
          maybe: true,
        },
      ],
    });

    // With Visa Interview (60k): confirmed plan 4,406,500 -> surplus 393,500 vs 4.8M; maybes +456,000 -> short -62,500
    expect(selectTotalFundsPkr(merged)).toBe(4_800_000);
    expect(selectPlanTotalPkr(merged)).toBe(4_406_500);
    expect(selectGapPkr(merged, false)).toBe(393_500);
    expect(selectMaybeTotalPkr(merged)).toBe(456_000);
    expect(selectPlanWithMaybesPkr(merged)).toBe(4_862_500);
    expect(selectGapPkr(merged, true)).toBe(-62_500);
  });

  it('handles temporary expired costs, variants, sub-costs, account balances, cross-currency transfers, and spending power', () => {
    const data = buildSeededAppData();
    const pkrAcc = {
      id: 'acc-pkr',
      name: 'Bank PKR',
      kind: 'bank' as const,
      currency: 'PKR' as const,
      openingBalance: 1_000_000,
      color: '#6366F1',
      icon: 'Wallet',
      includeInTotals: true,
      reserved: 100_000,
      archived: false,
      order: 0,
      createdAt: '2026-11-18',
    };
    const usdAcc = {
      id: 'acc-usd',
      name: 'USD Card',
      kind: 'card' as const,
      currency: 'USD' as const,
      openingBalance: 500,
      color: '#14B8A6',
      icon: 'CreditCard',
      includeInTotals: true,
      archived: false,
      order: 1,
      createdAt: '2026-11-18',
    };

    const txns = [
      {
        id: 't1',
        type: 'deposit' as const,
        date: '2026-11-18',
        accountId: 'acc-pkr',
        amount: 200_000,
        createdAt: '2026-11-18',
      },
      {
        id: 't2',
        type: 'transfer' as const,
        date: '2026-11-18',
        accountId: 'acc-pkr',
        toAccountId: 'acc-usd',
        amount: 280_000,
        toAmount: 1_000,
        createdAt: '2026-11-18',
      },
    ];

    expect(accountBalance(pkrAcc, txns)).toBe(920_000);
    expect(accountBalance(usdAcc, txns)).toBe(1_500);

    const stateWithAccounts = {
      ...data,
      accounts: [pkrAcc, usdAcc],
      transactions: txns,
    };

    // PKR available = 920k - 100k = 820k. USD available = $1,500 * 280 market = 420k. Total funds = 1,240,000 PKR
    expect(selectTotalFundsPkr(stateWithAccounts)).toBe(1_240_000);

    // Spending power USD = 1500 + 820,000 / 300 = 1500 + 2733.33 = 4233.33
    const sp = selectSpendingPowerUsd(stateWithAccounts);
    expect(sp.realUsdHeld).toBe(1_500);
    expect(sp.spendingPowerUsd).toBeCloseTo(4233.33, 1);

    // Payment from USD account to USD cost clears native USD amount
    const step3 = data.costs.find((c) => c.name === 'Step 3')!;
    const payTx = {
      id: 't3',
      type: 'payment' as const,
      date: '2026-11-18',
      accountId: 'acc-usd',
      costId: step3.id,
      amount: 955,
      createdAt: '2026-11-18',
    };
    expect(
      costPaid(step3, [...txns, payTx], [pkrAcc, usdAcc], data.settings)
    ).toBe(costTotal(step3, data.settings));
    expect(
      costStatus(step3, [...txns, payTx], [pkrAcc, usdAcc], data.settings)
    ).toBe('paid');

    // Sub-cost maybe extra
    const customWithMaybeSub = {
      ...step3,
      subCosts: [
        {
          id: 's1',
          name: 'Base',
          money: { amount: 100, currency: 'USD' as const },
          kind: 'fixed' as const,
          order: 0,
          included: true,
          maybe: false,
        },
        {
          id: 's2',
          name: 'Maybe surcharge',
          money: { amount: 50, currency: 'USD' as const },
          kind: 'fixed' as const,
          order: 1,
          included: true,
          maybe: true,
        },
      ],
    };
    expect(costTotal(customWithMaybeSub, data.settings)).toBe(30_000);
    expect(costMaybeExtra(customWithMaybeSub, data.settings)).toBe(15_000);
  });
});
