import { describe, it, expect } from 'vitest';
import { buildSeededAppData } from '../../store/seed';
import { buildTimeline } from '../../features/planner/timeline';
import type { Cost } from '../../types';

const base = buildSeededAppData();
const mk = (name: string, amount: number, dueDate?: string): Cost => ({
  ...base.costs[0],
  id: name,
  name,
  money: { amount, currency: 'PKR' },
  subCosts: [],
  variants: undefined,
  recurrence: undefined,
  temporary: undefined,
  maybe: false,
  included: true,
  archived: false,
  dueDate,
});

describe('planner timeline', () => {
  const costs = [mk('A', 100_000, '2026-11-01'), mk('B', 300_000, '2027-01-15'), mk('C', 50_000)];
  const input = {
    costs,
    transactions: [],
    accounts: [],
    settings: base.settings,
    fundsPkr: 200_000,
    monthlySave: 0,
    includeMaybes: false,
    goalDate: '2027-03-01',
    todayIso: '2026-11-18',
  };

  it('places costs by month, overdue in this month, undated last', () => {
    const t = buildTimeline(input);
    expect(t.months.map((m) => m.key)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(t.months[0].out).toBe(100_000);
    expect(t.months[0].items[0].overdue).toBe(true);
    expect(t.months[2].balanceAfter).toBe(-200_000);
    expect(t.undated?.out).toBe(50_000);
    expect(t.firstShortKey).toBe('2027-01');
    expect(t.lowest?.balance).toBe(-250_000);
  });

  it('works out the monthly saving that keeps every month covered', () => {
    const t = buildTimeline(input);
    // Jan (index 2): 400k due vs 200k → 100k/mo; undated by Mar (index 4): 450k vs 200k → 62.5k/mo
    expect(t.saveNeeded).toBe(100_000);
    const covered = buildTimeline({ ...input, monthlySave: 100_000 });
    expect(covered.firstShortKey).toBeNull();
  });
});
