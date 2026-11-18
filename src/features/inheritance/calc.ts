import { nanoid } from 'nanoid';
import type {
  InheritanceAllocation,
  InheritanceDeduction,
  InheritanceHeir,
  InheritanceLoan,
  InheritancePlan,
} from '../../types';

/** Pure maths for the Inheritance page. All amounts PKR. */

export const LAC = 100_000;

export function deductionAmount(d: InheritanceDeduction, total: number): number {
  return typeof d.percent === 'number' ? (total * d.percent) / 100 : d.amount;
}

export interface HeirRow {
  heir: InheritanceHeir;
  share: number; // by units from the net estate
  extra: number; // deductions paid to this heir (e.g. a reimbursement)
  entitlement: number; // share + extra
  loansIn: number;
  loansOut: number;
  held: number; // what they should end up holding after loans = entitlement + in − out
}

/** A row in the installment grid: an heir (target = held) or a paid-out deduction (target = amount). */
export interface Recipient {
  id: string;
  label: string;
  kind: 'heir' | InheritanceDeduction['kind'];
  target: number;
  isMe?: boolean;
}

export interface PlanSummary {
  deductionsTotal: number;
  net: number;
  unitsTotal: number;
  unitValue: number;
  heirs: HeirRow[];
  me?: HeirRow;
  recipients: Recipient[];
  installmentsTotal: number;
  receivedTotal: number;
  /** installments total − estate total (≠ 0 means the numbers don't line up) */
  installmentsDiff: number;
  allocatedByInstallment: Record<string, number>;
  allocatedByRecipient: Record<string, number>;
  myShortfall: number; // myTarget − my entitlement (before loans), ≥ 0
  myBorrowed: number;
  myToRepay: number; // loans to me not yet repaid
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function summarize(plan: InheritancePlan): PlanSummary {
  const deductionsTotal = sum(plan.deductions.map((d) => deductionAmount(d, plan.total)));
  const net = plan.total - deductionsTotal;
  const unitsTotal = sum(plan.heirs.map((h) => h.units));
  const unitValue = unitsTotal > 0 ? net / unitsTotal : 0;

  const heirs: HeirRow[] = plan.heirs.map((heir) => {
    const share = unitValue * heir.units;
    const extra = sum(
      plan.deductions.filter((d) => d.payTo === heir.id).map((d) => deductionAmount(d, plan.total))
    );
    const loansIn = sum(plan.loans.filter((l) => l.toId === heir.id).map((l) => l.amount));
    const loansOut = sum(plan.loans.filter((l) => l.fromId === heir.id).map((l) => l.amount));
    const entitlement = share + extra;
    return { heir, share, extra, entitlement, loansIn, loansOut, held: entitlement + loansIn - loansOut };
  });
  const me = heirs.find((h) => h.heir.isMe);

  const recipients: Recipient[] = [
    ...heirs.map((h) => ({
      id: h.heir.id,
      label: h.heir.name,
      kind: 'heir' as const,
      target: h.held,
      isMe: h.heir.isMe,
    })),
    ...plan.deductions
      .filter((d) => !d.payTo)
      .map((d) => ({ id: d.id, label: d.label, kind: d.kind, target: deductionAmount(d, plan.total) })),
  ];

  const installmentsTotal = sum(plan.installments.map((i) => i.amount));
  const receivedTotal = sum(plan.installments.filter((i) => i.received).map((i) => i.amount));

  const allocatedByInstallment: Record<string, number> = {};
  const allocatedByRecipient: Record<string, number> = {};
  for (const a of plan.allocations) {
    allocatedByInstallment[a.installmentId] = (allocatedByInstallment[a.installmentId] ?? 0) + a.amount;
    allocatedByRecipient[a.to] = (allocatedByRecipient[a.to] ?? 0) + a.amount;
  }

  const myShortfall = me && plan.myTarget ? Math.max(0, plan.myTarget - me.entitlement) : 0;
  const toMe = me ? plan.loans.filter((l) => l.toId === me.heir.id) : [];

  return {
    deductionsTotal,
    net,
    unitsTotal,
    unitValue,
    heirs,
    me,
    recipients,
    installmentsTotal,
    receivedTotal,
    installmentsDiff: installmentsTotal - plan.total,
    allocatedByInstallment,
    allocatedByRecipient,
    myShortfall,
    myBorrowed: sum(toMe.map((l) => l.amount)),
    myToRepay: sum(toMe.filter((l) => !l.repaid).map((l) => l.amount)),
  };
}

/**
 * Loans so "me" reaches myTarget. Lenders who receive a reimbursement lend it first (up to what's
 * still needed); whatever is left is split equally between the other chosen lenders.
 * Replaces existing loans to me (other loans are kept).
 */
export function autoLoans(plan: InheritancePlan, lenderIds: string[]): InheritanceLoan[] {
  const s = summarize({ ...plan, loans: plan.loans.filter((l) => !s0IsMe(plan, l.toId)) });
  const me = s.me;
  const others = plan.loans.filter((l) => !s0IsMe(plan, l.toId));
  if (!me || !plan.myTarget) return others;
  let need = Math.max(0, plan.myTarget - me.held);
  const loans: InheritanceLoan[] = [];
  const lenders = s.heirs.filter((h) => lenderIds.includes(h.heir.id) && !h.heir.isMe);
  for (const h of lenders) {
    if (need <= 0) break;
    if (h.extra > 0) {
      const amt = Math.min(h.extra, need);
      loans.push({ id: nanoid(8), fromId: h.heir.id, toId: me.heir.id, amount: amt });
      need -= amt;
    }
  }
  const rest = lenders.filter((h) => !loans.some((l) => l.fromId === h.heir.id));
  if (need > 0 && rest.length > 0) {
    const each = need / rest.length;
    for (const h of rest) loans.push({ id: nanoid(8), fromId: h.heir.id, toId: me.heir.id, amount: each });
  }
  return [...others, ...loans];
}
function s0IsMe(plan: InheritancePlan, heirId: string) {
  return plan.heirs.some((h) => h.id === heirId && h.isMe);
}

/**
 * Fill what isn't assigned yet, installment by installment (earliest first):
 * paid-out items (fees, tax, reserves) are covered first, then the rest is split between heirs
 * in proportion to what each still needs. Existing allocations are kept.
 */
export function autoFill(plan: InheritancePlan): InheritanceAllocation[] {
  const s = summarize(plan);
  const out = [...plan.allocations];
  const left: Record<string, number> = {};
  for (const r of s.recipients) left[r.id] = Math.max(0, r.target - (s.allocatedByRecipient[r.id] ?? 0));
  const add = (installmentId: string, to: string, amount: number) => {
    if (amount < 1) return;
    const i = out.findIndex((a) => a.installmentId === installmentId && a.to === to);
    if (i >= 0) out[i] = { ...out[i], amount: out[i].amount + amount };
    else out.push({ id: nanoid(8), installmentId, to, amount });
    left[to] -= amount;
  };
  const insts = [...plan.installments].sort((a, b) => a.date.localeCompare(b.date));
  const paidOut = s.recipients.filter((r) => r.kind !== 'heir');
  const heirs = s.recipients.filter((r) => r.kind === 'heir');
  for (const inst of insts) {
    let free = inst.amount - (s.allocatedByInstallment[inst.id] ?? 0);
    for (const r of paidOut) {
      if (free <= 0) break;
      const amt = Math.min(free, left[r.id]);
      add(inst.id, r.id, amt);
      free -= amt;
    }
    const need = sum(heirs.map((r) => left[r.id]));
    if (free <= 0 || need <= 0) continue;
    const pot = Math.min(free, need);
    // round to whole rupees; the last heir takes the rounding remainder
    let given = 0;
    const open = heirs.filter((r) => left[r.id] > 0);
    open.forEach((r, idx) => {
      const amt = idx === open.length - 1 ? pot - given : Math.round((pot * left[r.id]) / need);
      const capped = Math.min(amt, left[r.id]);
      add(inst.id, r.id, capped);
      given += capped;
    });
  }
  return out;
}

export function setAllocation(
  plan: InheritancePlan,
  installmentId: string,
  to: string,
  amount: number
): InheritanceAllocation[] {
  const rest = plan.allocations.filter((a) => !(a.installmentId === installmentId && a.to === to));
  if (!(amount > 0)) return rest;
  const existing = plan.allocations.find((a) => a.installmentId === installmentId && a.to === to);
  return [...rest, { id: existing?.id ?? nanoid(8), installmentId, to, amount, done: existing?.done }];
}

export function blankPlan(): InheritancePlan {
  const now = new Date().toISOString();
  return {
    total: 0,
    deductions: [{ id: nanoid(8), label: 'Tax', kind: 'tax', amount: 0 }],
    heirs: [{ id: nanoid(8), name: 'Me', relation: 'son', units: 2, isMe: true }],
    installments: [{ id: nanoid(8), date: now.slice(0, 10), amount: 0, received: false }],
    loans: [],
    allocations: [],
    unit: 'lac',
    updatedAt: now,
  };
}

export const UNIT_LABEL: Record<InheritancePlan['unit'], string> = { lac: 'lac', million: 'M', pkr: '₨' };
export const UNIT_FACTOR: Record<InheritancePlan['unit'], number> = { lac: LAC, million: 1_000_000, pkr: 1 };
