import type { Account, Cost, Settings, Transaction } from '../../types';
import {
  costDueParts,
  costMaybeExtra,
  costPaid,
  costSource,
  costTotal,
  getActivePlanCosts,
} from '../../store/selectors';
import { getConversionContext, moneyToPkr } from '../../lib/currency';

/** Pure maths for the Planner timeline. All amounts PKR at each cost's own conversion (after tax by default). */

export interface TimelineItem {
  costId: string;
  name: string;
  pkr: number;
  date?: string;
  maybe: boolean;
  overdue: boolean;
}

export interface TimelineBucket {
  key: string; // yyyy-mm, or 'none' for undated
  index: number; // months from now (0 = this month); undated = last index
  items: TimelineItem[];
  out: number;
  saved: number; // savings added up to this bucket
  balanceAfter: number;
}

export interface Timeline {
  months: TimelineBucket[];
  undated: TimelineBucket | null;
  totalOut: number;
  endBalance: number;
  lowest: { key: string; balance: number } | null;
  firstShortKey: string | null;
  /** Monthly saving that keeps every month ≥ 0 (null = already covered; Infinity = short this month). */
  saveNeeded: number | null;
  /** Undated costs make you short but there's no target date to spread savings over. */
  needsGoalDate: boolean;
}

export interface TimelineInput {
  costs: Cost[];
  transactions: Transaction[];
  accounts: Account[];
  settings: Settings;
  fundsPkr: number;
  monthlySave: number;
  includeMaybes: boolean;
  /** Undated costs are assumed paid by this date (else after the last dated month). */
  goalDate?: string | null;
  todayIso?: string;
}

const monthKey = (iso: string) => iso.slice(0, 7);
function monthsBetween(fromKey: string, toKey: string): number {
  const [y1, m1] = fromKey.split('-').map(Number);
  const [y2, m2] = toKey.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
function addMonthKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function buildTimeline(input: TimelineInput): Timeline {
  const today = input.todayIso ?? new Date().toISOString().slice(0, 10);
  const nowKey = monthKey(today);
  const { settings } = input;

  const items: TimelineItem[] = [];
  for (const c of getActivePlanCosts(input.costs, today)) {
    if (c.maybe && !input.includeMaybes) continue;
    const total = costTotal(c, settings);
    const paid = costPaid(c, input.transactions, input.accounts, settings);
    const left = total > 0 ? Math.max(0, 1 - paid / total) : 0;
    for (const p of costDueParts(c, settings)) {
      const pkr = p.pkr * left;
      if (pkr < 0.5) continue;
      items.push({
        costId: c.id,
        name: c.name,
        pkr,
        date: p.date,
        maybe: c.maybe,
        overdue: !!p.date && p.date < today,
      });
    }
    if (input.includeMaybes) {
      const extra = costMaybeExtra(c, settings);
      if (extra >= 0.5) {
        items.push({
          costId: c.id,
          name: `${c.name} (maybe items)`,
          pkr: extra,
          date: c.dueDate,
          maybe: true,
          overdue: !!c.dueDate && c.dueDate < today,
        });
      }
    }
  }

  const dated = items.filter((i) => i.date);
  const lastKey = dated.reduce((k, i) => (monthKey(i.date!) > k ? monthKey(i.date!) : k), nowKey);
  const count = Math.min(36, monthsBetween(nowKey, lastKey)) + 1;

  const months: TimelineBucket[] = [];
  let balance = input.fundsPkr;
  let totalOut = 0;
  for (let i = 0; i < count; i++) {
    const key = addMonthKey(nowKey, i);
    const inMonth = dated
      .filter((it) => {
        const k = monthKey(it.date!);
        return i === 0 ? k <= key : i === count - 1 ? k >= key : k === key; // overdue → now; beyond cap → last
      })
      .sort((a, b) => a.date!.localeCompare(b.date!));
    const out = inMonth.reduce((s, it) => s + it.pkr, 0);
    const saved = i > 0 ? input.monthlySave : 0;
    balance += saved - out;
    totalOut += out;
    months.push({
      key,
      index: i,
      items: inMonth,
      out,
      saved: input.monthlySave * i,
      balanceAfter: balance,
    });
  }

  const undatedItems = items.filter((i) => !i.date).sort((a, b) => b.pkr - a.pkr);
  let undated: TimelineBucket | null = null;
  if (undatedItems.length) {
    const goalIdx = input.goalDate ? monthsBetween(nowKey, monthKey(input.goalDate)) : -1;
    const index = Math.max(count - 1, goalIdx);
    const extraMonths = index - (count - 1);
    const out = undatedItems.reduce((s, it) => s + it.pkr, 0);
    balance += input.monthlySave * extraMonths - out;
    totalOut += out;
    undated = {
      key: 'none',
      index,
      items: undatedItems,
      out,
      saved: input.monthlySave * index,
      balanceAfter: balance,
    };
  }

  const all = undated ? [...months, undated] : months;
  const lowestB = all.reduce<TimelineBucket | null>(
    (lo, b) => (!lo || b.balanceAfter < lo.balanceAfter ? b : lo),
    null
  );
  const firstShort = all.find((b) => b.balanceAfter < -0.5) ?? null;

  // saving s keeps month i covered when funds + s·i − cumulative_out(i) ≥ 0
  // (undated costs only count here when a target date says by when they're due)
  let saveNeeded: number | null = null;
  let needsGoalDate = false;
  if (firstShort) {
    let cum = 0;
    let need = 0;
    for (const b of all) {
      cum += b.out;
      const gap = cum - input.fundsPkr;
      if (gap <= 0.5) continue;
      if (b.key === 'none' && !input.goalDate) {
        needsGoalDate = true;
        continue;
      }
      need = b.index === 0 ? Infinity : Math.max(need, gap / b.index);
    }
    saveNeeded = need > 0 ? need : null;
  }

  return {
    months,
    undated,
    totalOut,
    endBalance: balance,
    lowest: lowestB ? { key: lowestB.key, balance: lowestB.balanceAfter } : null,
    firstShortKey: firstShort?.key ?? null,
    saveNeeded,
    needsGoalDate,
  };
}

/** Plan total for a scenario (display only): lean = musts at the low estimate; comfortable = high estimate + maybes. */
export type Scenario = 'lean' | 'expected' | 'comfortable';
export function scenarioTotal(costs: Cost[], settings: Settings, scenario: Scenario): number {
  const ctx = getConversionContext(settings);
  let sum = 0;
  for (const c of getActivePlanCosts(costs)) {
    if (scenario !== 'comfortable' && c.maybe) continue;
    if (scenario === 'lean' && c.priority !== 'must') continue;
    const src = costSource(c);
    const occ = c.recurrence?.occurrences ?? 1;
    if (src.range && src.subCosts.length === 0 && scenario !== 'expected') {
      const bound = scenario === 'lean' ? src.range.low : src.range.high;
      sum += moneyToPkr({ amount: bound, currency: src.money.currency }, ctx, c.conversionMode, c.tax) * occ;
    } else {
      sum += costTotal(c, settings);
    }
    if (scenario === 'comfortable') sum += costMaybeExtra(c, settings);
  }
  return sum;
}
