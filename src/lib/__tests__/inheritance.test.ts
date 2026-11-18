import { describe, expect, it } from 'vitest';
import type { InheritancePlan } from '../../types';
import { autoFill, autoLoans, summarize, LAC } from '../../features/inheritance/calc';

// Synthetic family (not real data): 100 lac estate, 2 sons (2 units) + 3 daughters (1 unit).
function plan(): InheritancePlan {
  return {
    total: 100 * LAC,
    deductions: [
      { id: 'fee', label: 'Dealer', kind: 'fee', amount: 2 * LAC },
      { id: 'reimb', label: 'Reimbursement', kind: 'reimbursement', amount: 14 * LAC, payTo: 'b' },
      { id: 'res', label: 'Parents', kind: 'reserve', amount: 4 * LAC },
      { id: 'tax', label: 'Tax', kind: 'tax', amount: 0, percent: 3 },
    ],
    heirs: [
      { id: 'a', name: 'A', relation: 'son', units: 2, isMe: true },
      { id: 'b', name: 'B', relation: 'son', units: 2 },
      { id: 'c', name: 'C', relation: 'daughter', units: 1 },
      { id: 'd', name: 'D', relation: 'daughter', units: 1 },
      { id: 'e', name: 'E', relation: 'daughter', units: 1 },
    ],
    installments: [
      { id: 'i1', date: '2026-01-01', amount: 10 * LAC, received: true },
      { id: 'i2', date: '2026-03-01', amount: 30 * LAC, received: false },
      { id: 'i3', date: '2026-06-01', amount: 60 * LAC, received: false },
    ],
    loans: [],
    allocations: [],
    myTarget: 40 * LAC,
    unit: 'lac',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('inheritance calc', () => {
  it('divides the net estate by units and adds reimbursements to the payee', () => {
    const s = summarize(plan());
    expect(s.deductionsTotal).toBe(23 * LAC); // 2 + 14 + 4 + 3% of 100
    expect(s.net).toBe(77 * LAC);
    expect(s.unitValue).toBe(11 * LAC);
    expect(s.heirs.find((h) => h.heir.id === 'b')!.entitlement).toBe(36 * LAC);
    expect(s.myShortfall).toBe(18 * LAC);
    expect(s.installmentsDiff).toBe(0);
  });

  it('auto-loans: reimbursement holder lends first, the rest split equally', () => {
    const p = plan();
    p.loans = autoLoans(p, ['b', 'c', 'd', 'e']);
    const s = summarize(p);
    expect(p.loans.find((l) => l.fromId === 'b')!.amount).toBe(14 * LAC);
    expect(p.loans.find((l) => l.fromId === 'c')!.amount).toBeCloseTo((4 * LAC) / 3, 6);
    expect(s.me!.held).toBeCloseTo(40 * LAC, 6);
    // everything still adds up to the estate
    const held = s.recipients.reduce((a, r) => a + r.target, 0);
    expect(held).toBeCloseTo(100 * LAC, 4);
  });

  it('auto-fill pays fees first and assigns every installment fully', () => {
    const p = plan();
    p.loans = autoLoans(p, ['b', 'c', 'd', 'e']);
    p.allocations = [{ id: 'x', installmentId: 'i1', to: 'fee', amount: 2 * LAC, done: true }];
    p.allocations = autoFill(p);
    const s = summarize(p);
    for (const i of p.installments) expect(s.allocatedByInstallment[i.id]).toBeCloseTo(i.amount, 0);
    for (const r of s.recipients) expect(s.allocatedByRecipient[r.id] ?? 0).toBeCloseTo(r.target, -1);
    // the kept manual allocation is untouched
    expect(p.allocations.find((a) => a.id === 'x')!.amount).toBe(2 * LAC);
    // reserve + tax come out of the first installment
    expect(p.allocations.find((a) => a.installmentId === 'i1' && a.to === 'res')!.amount).toBe(4 * LAC);
  });
});
