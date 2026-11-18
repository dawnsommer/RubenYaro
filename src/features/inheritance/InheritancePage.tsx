import { ReactNode, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Landmark,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Amount, Button, Checkbox, Dialog, Progress, Segmented } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { parseAmount } from '../../lib/parseAmount';
import { daysUntil, formatShortDate } from '../../lib/dates';
import type {
  InheritanceDeduction,
  InheritanceHeir,
  InheritanceInstallment,
  InheritancePlan,
} from '../../types';
import {
  autoFill,
  autoLoans,
  blankPlan,
  deductionAmount,
  setAllocation,
  summarize,
  UNIT_FACTOR,
  UNIT_LABEL,
} from './calc';

type Unit = InheritancePlan['unit'];

/** Number input that shows/edits a PKR value in the chosen unit. Accepts "2.5", "250k", "3 lac", "1.2m", "15+3". */
function UnitInput({
  value,
  unit,
  onChange,
  className = '',
  placeholder = '0',
  ariaLabel,
}: {
  value: number;
  unit: Unit;
  onChange: (pkr: number) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  // precise while editing, 2 decimals otherwise (exact PKR value in the tooltip)
  const shown = (v: number, precise: boolean) => {
    if (!v) return '';
    const n = v / UNIT_FACTOR[unit];
    const digits = unit === 'pkr' ? 0 : precise ? 4 : unit === 'million' ? 3 : 2;
    return String(Number(n.toFixed(digits)));
  };
  const [draft, setDraft] = useState(shown(value, false));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(shown(value, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit, focused]);

  const commit = () => {
    const raw = draft.trim();
    if (raw === shown(value, true) || raw === shown(value, false)) return; // untouched — keep the exact value
    if (!raw) return onChange(0);
    // a bare number is in the current unit; anything with a suffix/operator goes through parseAmount
    const bare = /^-?\d+(\.\d+)?$/.test(raw.replace(/,/g, ''));
    const pkr = bare ? Number(raw.replace(/,/g, '')) * UNIT_FACTOR[unit] : parseAmount(raw);
    if (pkr === null || !Number.isFinite(pkr)) return setDraft(shown(value, false));
    onChange(Math.round(pkr));
  };

  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      title={value ? `₨ ${Math.round(value).toLocaleString('en-US')}` : undefined}
      onFocus={(e) => {
        setFocused(true);
        setDraft(shown(value, true));
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      className={`num ${className}`}
    />
  );
}

function SectionCard({
  title,
  hint,
  aside,
  children,
  className = '',
}: {
  title: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {hint && <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>}
        </div>
        {aside && <div className="flex items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

const RELATIONS = [
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];
const DEDUCTION_KINDS = [
  { value: 'fee', label: 'Fee' },
  { value: 'tax', label: 'Tax' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'other', label: 'Other' },
];
const KIND_DOT: Record<string, string> = {
  heir: 'var(--accent)',
  fee: 'var(--warning)',
  tax: 'var(--negative)',
  reserve: 'var(--maybe)',
  reimbursement: 'var(--positive)',
  other: 'var(--text-faint)',
};

const cellCls =
  'w-full min-w-[84px] h-9 rounded-[10px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] focus:bg-[var(--surface)] border border-transparent focus:border-[var(--accent)] outline-none px-2 text-right text-[13px] transition-colors';
const inlineCls =
  'h-9 rounded-[10px] bg-transparent hover:bg-[var(--surface-2)] focus:bg-[var(--surface)] border border-transparent focus:border-[var(--accent)] outline-none px-2 text-sm transition-colors';

export function InheritancePage() {
  const plan = useStore((s) => s.inheritance ?? null);
  const setInheritance = useStore((s) => s.setInheritance);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [confirmReset, setConfirmReset] = useState(false);
  const [lenders, setLenders] = useState<string[] | null>(null);

  if (!plan) {
    return (
      <div>
        <PageHeader title="Inheritance" subtitle="Plan upcoming family money — kept apart from your accounts and costs." />
        <section className="card p-8 text-center max-w-[520px] mx-auto">
          <div className="w-12 h-12 rounded-[14px] mx-auto grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]">
            <Landmark className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No inheritance plan yet</h2>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Add the estate, who inherits and the installments it arrives in. Then decide who gets what from each
            installment, which one covers the tax, and any loans between siblings.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => setInheritance(blankPlan())}>
              <Plus className="w-4 h-4" /> Start a plan
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            Have a saved plan? Import it in Settings → Data.
          </p>
        </section>
      </div>
    );
  }

  return (
    <PlanView
      plan={plan}
      update={(patch) => setInheritance({ ...plan, ...patch })}
      view={view}
      setView={setView}
      lenders={lenders}
      setLenders={setLenders}
      onReset={() => setConfirmReset(true)}
      resetDialog={
        <Dialog
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            setInheritance(null);
            setConfirmReset(false);
          }}
          title="Delete the inheritance plan?"
          description="This removes the estate, heirs, installments and allocations from this app. Export a backup first if you want to keep them."
          confirmLabel="Delete plan"
          danger
        />
      }
    />
  );
}

function PlanView({
  plan,
  update,
  view,
  setView,
  lenders,
  setLenders,
  onReset,
  resetDialog,
}: {
  plan: InheritancePlan;
  update: (patch: Partial<InheritancePlan>) => void;
  view: 'grid' | 'list';
  setView: (v: 'grid' | 'list') => void;
  lenders: string[] | null;
  setLenders: (v: string[]) => void;
  onReset: () => void;
  resetDialog: ReactNode;
}) {
  const unit = plan.unit;
  const s = useMemo(() => summarize(plan), [plan]);
  const insts = useMemo(
    () => [...plan.installments].sort((a, b) => a.date.localeCompare(b.date)),
    [plan.installments]
  );
  const heirName = (id: string) => plan.heirs.find((h) => h.id === id)?.name ?? '—';
  const A = (pkr: number, cls = '') => <Amount pkr={pkr} pkrUnit={unit} className={cls} />;

  const me = s.me;
  const nextInst = insts.find((i) => !i.received);
  const receivedPct = s.installmentsTotal > 0 ? (s.receivedTotal / s.installmentsTotal) * 100 : 0;
  const lenderIds = lenders ?? plan.heirs.filter((h) => !h.isMe).map((h) => h.id);

  // ── mutators ──
  const patchHeir = (id: string, p: Partial<InheritanceHeir>) =>
    update({ heirs: plan.heirs.map((h) => (h.id === id ? { ...h, ...p } : h)) });
  const setMe = (id: string) => update({ heirs: plan.heirs.map((h) => ({ ...h, isMe: h.id === id })) });
  const removeHeir = (id: string) =>
    update({
      heirs: plan.heirs.filter((h) => h.id !== id),
      loans: plan.loans.filter((l) => l.fromId !== id && l.toId !== id),
      allocations: plan.allocations.filter((a) => a.to !== id),
      deductions: plan.deductions.map((d) => (d.payTo === id ? { ...d, payTo: undefined } : d)),
    });
  const patchDeduction = (id: string, p: Partial<InheritanceDeduction>) =>
    update({ deductions: plan.deductions.map((d) => (d.id === id ? { ...d, ...p } : d)) });
  const removeDeduction = (id: string) =>
    update({
      deductions: plan.deductions.filter((d) => d.id !== id),
      allocations: plan.allocations.filter((a) => a.to !== id),
    });
  const patchInst = (id: string, p: Partial<InheritanceInstallment>) =>
    update({ installments: plan.installments.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const removeInst = (id: string) =>
    update({
      installments: plan.installments.filter((i) => i.id !== id),
      allocations: plan.allocations.filter((a) => a.installmentId !== id),
    });
  const cell = (instId: string, to: string) =>
    plan.allocations.find((a) => a.installmentId === instId && a.to === to);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inheritance"
        subtitle="Upcoming family money — not linked to your accounts or plan totals."
        actions={
          <>
            <Segmented<Unit>
              size="sm"
              ariaLabel="Unit"
              value={unit}
              onChange={(v) => update({ unit: v })}
              options={[
                { value: 'lac', label: 'Lac' },
                { value: 'million', label: 'Million' },
                { value: 'pkr', label: '₨' },
              ]}
            />
            <Button variant="ghost" size="sm" onClick={onReset} tooltip="Delete plan" iconOnly aria-label="Delete plan">
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        }
      />

      {/* ── Summary ── */}
      <section className="card p-5 sm:p-6 relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: 'linear-gradient(90deg, var(--hero-from), var(--hero-to))' }}
        />
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[13px] font-medium text-[var(--text-muted)]">
              {me ? `${me.heir.name} — money in hand` : 'Pick who you are in Shares'}
            </p>
            <p className="mt-1 text-[38px] leading-none font-semibold tracking-[-0.04em]">
              {A(me?.held ?? 0)}
            </p>
            {me && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-[var(--text-muted)]">
                <span>
                  Share <span className="font-semibold text-[var(--text)]">{A(me.entitlement)}</span>
                </span>
                {me.loansIn > 0 && (
                  <span>
                    Borrowed <span className="font-semibold text-[var(--text)]">{A(me.loansIn)}</span>
                  </span>
                )}
                {s.myToRepay > 0 && (
                  <span>
                    To repay later <span className="font-semibold text-[var(--warning)]">{A(s.myToRepay)}</span>
                  </span>
                )}
                {plan.myTarget ? (
                  <span>
                    Target <span className="font-semibold text-[var(--text)]">{A(plan.myTarget)}</span>
                    {Math.round(me.held) >= Math.round(plan.myTarget) ? (
                      <Check className="inline w-3.5 h-3.5 ml-1 text-[var(--positive)]" />
                    ) : null}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="md:border-l md:border-[var(--border)] md:pl-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-[var(--text-muted)]">Received</p>
              <p className="text-sm num">
                <span className="font-semibold">{A(s.receivedTotal)}</span>
                <span className="text-[var(--text-faint)]"> / {A(s.installmentsTotal)}</span>
              </p>
            </div>
            <Progress value={receivedPct} className="mt-2" />
            {nextInst ? (
              <div className="mt-4 flex items-center gap-3">
                <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]">
                  <CalendarDays className="w-[18px] h-[18px]" />
                </span>
                <div className="text-sm">
                  <p className="font-medium">
                    Next: {A(nextInst.amount)} on {formatShortDate(nextInst.date)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {(() => {
                      const d = daysUntil(nextInst.date);
                      return d > 0 ? `in ${d} days` : d === 0 ? 'today' : `${-d} days ago — mark it received`;
                    })()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--positive)] font-medium">All installments received</p>
            )}
          </div>
        </div>

        {Math.abs(s.installmentsDiff) >= 1 && (
          <div className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-[var(--warning-soft)] px-3.5 py-2.5 text-[13px] text-[var(--warning)]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Installments add up to <b>{A(s.installmentsTotal)}</b>, which is{' '}
              <b>{A(Math.abs(s.installmentsDiff))}</b> {s.installmentsDiff > 0 ? 'more' : 'less'} than the estate
              total of <b>{A(plan.total)}</b>. Check the amounts.
            </span>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ── Estate ── */}
        <SectionCard
          title="Estate"
          hint="Total value, and what comes off before it's divided."
          aside={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                update({
                  deductions: [...plan.deductions, { id: nanoid(8), label: 'New deduction', kind: 'other', amount: 0 }],
                })
              }
            >
              <Plus className="w-3.5 h-3.5" /> Deduction
            </Button>
          }
        >
          <label className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-sm font-medium">Total value</span>
            <span className="flex items-center gap-1.5">
              <UnitInput
                ariaLabel="Total value"
                value={plan.total}
                unit={unit}
                onChange={(v) => update({ total: v })}
                className={`${cellCls} !w-32 !bg-[var(--surface)]`}
              />
              <span className="text-xs text-[var(--text-muted)] w-6">{UNIT_LABEL[unit]}</span>
            </span>
          </label>

          <ul className="mt-2 divide-y divide-[var(--border)]">
            {plan.deductions.map((d) => (
              <li key={d.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: KIND_DOT[d.kind] }} />
                  <input
                    value={d.label}
                    aria-label="Deduction name"
                    onChange={(e) => patchDeduction(d.id, { label: e.target.value })}
                    className={`${inlineCls} flex-1 min-w-0 font-medium`}
                  />
                  {typeof d.percent === 'number' ? (
                    <span className="flex items-center gap-1">
                      <input
                        inputMode="decimal"
                        aria-label="Percent of total"
                        value={d.percent}
                        onChange={(e) => patchDeduction(d.id, { percent: Number(e.target.value) || 0 })}
                        className={`${cellCls} !w-16 !min-w-0`}
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                    </span>
                  ) : (
                    <UnitInput
                      ariaLabel={`${d.label} amount`}
                      value={d.amount}
                      unit={unit}
                      onChange={(v) => patchDeduction(d.id, { amount: v })}
                      className={`${cellCls} !w-24`}
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeDeduction(d.id)}
                    className="w-7 h-7 shrink-0 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-1 pl-4 flex flex-wrap items-center gap-1.5 text-xs">
                  <select
                    aria-label="Kind"
                    value={d.kind}
                    onChange={(e) => patchDeduction(d.id, { kind: e.target.value as InheritanceDeduction['kind'] })}
                    className="h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-2.5 outline-none cursor-pointer text-[var(--text-muted)]"
                  >
                    {DEDUCTION_KINDS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Goes to"
                    value={d.payTo ?? ''}
                    onChange={(e) => patchDeduction(d.id, { payTo: e.target.value || undefined })}
                    className="h-7 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] px-2.5 outline-none cursor-pointer text-[var(--text-muted)]"
                  >
                    <option value="">Paid out</option>
                    {plan.heirs.map((h) => (
                      <option key={h.id} value={h.id}>
                        Goes to {h.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title={typeof d.percent === 'number' ? 'Use a fixed amount' : 'Use % of total'}
                    onClick={() =>
                      patchDeduction(
                        d.id,
                        typeof d.percent === 'number'
                          ? { percent: undefined, amount: Math.round(deductionAmount(d, plan.total)) }
                          : { percent: plan.total ? Number(((d.amount / plan.total) * 100).toFixed(2)) : 0 }
                      )
                    }
                    className="h-7 px-2.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] cursor-pointer"
                  >
                    {typeof d.percent === 'number' ? (
                      <>= {A(deductionAmount(d, plan.total))} · use fixed</>
                    ) : (
                      'use % of total'
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between rounded-[12px] border border-[var(--border)] px-3.5 py-2.5">
            <span className="text-sm text-[var(--text-muted)]">
              Net estate <span className="text-[var(--text-faint)]">(− {A(s.deductionsTotal)})</span>
            </span>
            <span className="text-base font-semibold">{A(s.net)}</span>
          </div>
        </SectionCard>

        {/* ── Shares ── */}
        <SectionCard
          title="Shares"
          hint={
            s.unitsTotal > 0 ? (
              <>
                {s.unitsTotal} units · 1 unit = {A(s.unitValue)}
              </>
            ) : (
              'Add who inherits and their units (e.g. son 2, daughter 1).'
            )
          }
          aside={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                update({
                  heirs: [
                    ...plan.heirs,
                    { id: nanoid(8), name: 'New', relation: 'daughter', units: 1, isMe: plan.heirs.length === 0 },
                  ],
                })
              }
            >
              <Plus className="w-3.5 h-3.5" /> Person
            </Button>
          }
        >
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[460px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-faint)]">
                  <th className="text-left font-medium px-2 pb-2">Name</th>
                  <th className="text-center font-medium px-1 pb-2">Units</th>
                  <th className="text-right font-medium px-2 pb-2">Share</th>
                  <th className="text-right font-medium px-2 pb-2">Loans</th>
                  <th className="text-right font-medium px-2 pb-2">Holds</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {s.heirs.map((r) => (
                  <tr key={r.heir.id} className={r.heir.isMe ? 'bg-[var(--accent-soft)]/40' : ''}>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={r.heir.isMe ? 'This is you' : 'Set as me'}
                          onClick={() => setMe(r.heir.id)}
                          className={`w-7 h-7 shrink-0 grid place-items-center rounded-full cursor-pointer ${
                            r.heir.isMe
                              ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                              : 'text-[var(--text-faint)] hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>
                        <div className="min-w-0">
                          <input
                            value={r.heir.name}
                            aria-label="Name"
                            onChange={(e) => patchHeir(r.heir.id, { name: e.target.value })}
                            className={`${inlineCls} w-full font-medium !h-8`}
                          />
                          <select
                            aria-label="Relation"
                            value={r.heir.relation}
                            onChange={(e) =>
                              patchHeir(r.heir.id, { relation: e.target.value as InheritanceHeir['relation'] })
                            }
                            className="block bg-transparent text-[11px] text-[var(--text-muted)] px-2 -mt-0.5 outline-none cursor-pointer"
                          >
                            {RELATIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <input
                        inputMode="decimal"
                        aria-label="Units"
                        value={r.heir.units}
                        onChange={(e) => patchHeir(r.heir.id, { units: Number(e.target.value) || 0 })}
                        className={`${cellCls} !min-w-0 !w-12 !text-center`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right num">
                      {A(r.share)}
                      {r.extra > 0 && (
                        <span className="block text-[11px] text-[var(--positive)]">+ {A(r.extra)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right num text-[13px]">
                      {r.loansIn > 0 && <span className="block text-[var(--positive)]">+ {A(r.loansIn)}</span>}
                      {r.loansOut > 0 && <span className="block text-[var(--negative)]">− {A(r.loansOut)}</span>}
                      {r.loansIn === 0 && r.loansOut === 0 && <span className="text-[var(--text-faint)]">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold num">{A(r.held)}</td>
                    <td className="pr-1">
                      <button
                        type="button"
                        aria-label={`Remove ${r.heir.name}`}
                        onClick={() => removeHeir(r.heir.id)}
                        className="w-7 h-7 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* ── Target & loans ── */}
      <SectionCard
        title="My target & loans"
        hint="How much you need in hand, and who lends you the difference."
      >
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-muted)]">I need in hand</span>
              <span className="mt-1 flex items-center gap-1.5">
                <UnitInput
                  ariaLabel="Target"
                  value={plan.myTarget ?? 0}
                  unit={unit}
                  onChange={(v) => update({ myTarget: v || undefined })}
                  className="field num"
                />
                <span className="text-xs text-[var(--text-muted)] w-6">{UNIT_LABEL[unit]}</span>
              </span>
            </label>
            {me && plan.myTarget ? (
              <div className="rounded-[12px] bg-[var(--surface-2)] px-3.5 py-3 text-[13px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">My share</span>
                  <span className="num">{A(me.entitlement)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Short by</span>
                  <span className="num font-semibold">{A(s.myShortfall)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Borrowed so far</span>
                  <span
                    className={`num font-semibold ${
                      Math.round(s.myBorrowed) >= Math.round(s.myShortfall)
                        ? 'text-[var(--positive)]'
                        : 'text-[var(--warning)]'
                    }`}
                  >
                    {A(s.myBorrowed)}
                  </span>
                </div>
              </div>
            ) : null}
            {me && plan.myTarget ? (
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Borrow from</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.heirs
                    .filter((h) => !h.isMe)
                    .map((h) => {
                      const on = lenderIds.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() =>
                            setLenders(on ? lenderIds.filter((x) => x !== h.id) : [...lenderIds, h.id])
                          }
                          className={`h-7 px-3 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                            on
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent'
                              : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          {h.name}
                        </button>
                      );
                    })}
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => update({ loans: autoLoans(plan, lenderIds) })}
                >
                  <Wand2 className="w-3.5 h-3.5" /> Split the shortfall
                </Button>
                <p className="mt-1.5 text-[11px] text-[var(--text-faint)]">
                  Anyone owed a reimbursement lends that first; the rest is split equally.
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">Loans</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const from = plan.heirs.find((h) => !h.isMe);
                  const to = plan.heirs.find((h) => h.isMe) ?? plan.heirs[0];
                  if (!from || !to) return;
                  update({ loans: [...plan.loans, { id: nanoid(8), fromId: from.id, toId: to.id, amount: 0 }] });
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Loan
              </Button>
            </div>
            {plan.loans.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] rounded-[12px] border border-dashed border-[var(--border)] px-4 py-6 text-center">
                No loans between family members.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {plan.loans.map((l) => (
                  <li
                    key={l.id}
                    className={`flex flex-wrap items-center gap-2 rounded-[12px] px-2 py-1.5 ${
                      l.repaid ? 'bg-[var(--positive-soft)]' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    <select
                      aria-label="From"
                      value={l.fromId}
                      onChange={(e) =>
                        update({ loans: plan.loans.map((x) => (x.id === l.id ? { ...x, fromId: e.target.value } : x)) })
                      }
                      className="bg-transparent text-sm font-medium outline-none cursor-pointer px-1 h-8"
                    >
                      {plan.heirs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-[var(--text-faint)]">lends</span>
                    <select
                      aria-label="To"
                      value={l.toId}
                      onChange={(e) =>
                        update({ loans: plan.loans.map((x) => (x.id === l.id ? { ...x, toId: e.target.value } : x)) })
                      }
                      className="bg-transparent text-sm font-medium outline-none cursor-pointer px-1 h-8"
                    >
                      {plan.heirs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center gap-2 ml-auto">
                      <UnitInput
                        ariaLabel="Loan amount"
                        value={l.amount}
                        unit={unit}
                        onChange={(v) =>
                          update({ loans: plan.loans.map((x) => (x.id === l.id ? { ...x, amount: v } : x)) })
                        }
                        className={`${cellCls} !w-24 !bg-[var(--surface)]`}
                      />
                      <Checkbox
                        checked={!!l.repaid}
                        onChange={(v) =>
                          update({ loans: plan.loans.map((x) => (x.id === l.id ? { ...x, repaid: v } : x)) })
                        }
                        label="Repaid"
                      />
                      <button
                        type="button"
                        aria-label="Remove loan"
                        onClick={() => update({ loans: plan.loans.filter((x) => x.id !== l.id) })}
                        className="w-7 h-7 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {me && s.myBorrowed > 0 && (
              <p className="mt-3 text-[13px] text-[var(--text-muted)]">
                {me.heir.name} repays{' '}
                {plan.loans
                  .filter((l) => l.toId === me.heir.id)
                  .map((l, i, arr) => (
                    <span key={l.id}>
                      <b className={`text-[var(--text)] ${l.repaid ? 'line-through opacity-60' : ''}`}>
                        {heirName(l.fromId)} {A(l.amount)}
                      </b>
                      {i < arr.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Installments ── */}
      <SectionCard
        title="Installments"
        hint="When the money arrives. Tick one when it's in hand."
        aside={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              update({
                installments: [
                  ...plan.installments,
                  {
                    id: nanoid(8),
                    date: insts[insts.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
                    amount: 0,
                    received: false,
                  },
                ],
              })
            }
          >
            <Plus className="w-3.5 h-3.5" /> Installment
          </Button>
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {insts.map((inst, idx) => {
            const assigned = s.allocatedByInstallment[inst.id] ?? 0;
            const free = inst.amount - assigned;
            return (
              <div
                key={inst.id}
                className={`rounded-[14px] border p-3 space-y-2 ${
                  inst.received
                    ? 'border-transparent bg-[var(--positive-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove installment"
                    onClick={() => removeInst(inst.id)}
                    className="w-6 h-6 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="date"
                  aria-label="Date"
                  value={inst.date}
                  onChange={(e) => patchInst(inst.id, { date: e.target.value })}
                  className="field !h-9 !py-1 text-[13px]"
                />
                <div className="flex items-center gap-1.5">
                  <UnitInput
                    ariaLabel="Installment amount"
                    value={inst.amount}
                    unit={unit}
                    onChange={(v) => patchInst(inst.id, { amount: v })}
                    className="field !h-9 !py-1 font-semibold"
                  />
                  <span className="text-xs text-[var(--text-muted)]">{UNIT_LABEL[unit]}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={inst.received}
                  onClick={() => patchInst(inst.id, { received: !inst.received })}
                  className={`w-full h-8 rounded-[10px] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    inst.received
                      ? 'bg-[var(--positive)] text-white'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'
                  }`}
                >
                  {inst.received ? <Check className="w-3.5 h-3.5" /> : null}
                  {inst.received ? 'Received' : 'Mark received'}
                </button>
                <p
                  className={`text-[11px] num text-center ${
                    Math.abs(free) < 1
                      ? 'text-[var(--positive)]'
                      : free < 0
                        ? 'text-[var(--negative)]'
                        : 'text-[var(--text-muted)]'
                  }`}
                >
                  {Math.abs(free) < 1 ? 'All assigned' : free < 0 ? <>Over by {A(-free)}</> : <>{A(free)} not assigned</>}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Who gets what ── */}
      <SectionCard
        title="Who gets what, from which installment"
        hint="Type amounts in the grid, or let Auto-fill cover fees and tax first and split the rest by what each person still needs."
        aside={
          <>
            <Segmented
              size="sm"
              ariaLabel="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'By installment' },
              ]}
            />
            <Button size="sm" onClick={() => update({ allocations: autoFill(plan) })}>
              <Sparkles className="w-3.5 h-3.5" /> Auto-fill
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ allocations: plan.allocations.filter((a) => a.done) })}
              tooltip="Clear everything not marked done"
            >
              Clear
            </Button>
          </>
        }
      >
        {view === 'grid' ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm border-separate border-spacing-x-1 border-spacing-y-1">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--surface)] text-left text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-faint)] pr-2 min-w-[120px]">
                    Who
                  </th>
                  {insts.map((inst, idx) => (
                    <th key={inst.id} className="text-right font-medium px-1 min-w-[92px]">
                      <span className="block text-[11px] text-[var(--text-faint)] uppercase tracking-[0.06em] whitespace-nowrap">
                        #{idx + 1} · {formatShortDate(inst.date)}
                      </span>
                      <span className={`block text-[13px] ${inst.received ? 'text-[var(--positive)]' : ''}`}>
                        {A(inst.amount)}
                      </span>
                    </th>
                  ))}
                  <th className="text-right text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-faint)] pl-2 min-w-[96px]">
                    Planned / due
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.recipients.map((r) => {
                  const got = s.allocatedByRecipient[r.id] ?? 0;
                  const left = r.target - got;
                  return (
                    <tr key={r.id}>
                      <td className="sticky left-0 z-10 bg-[var(--surface)] pr-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: KIND_DOT[r.kind] }} />
                          <span className={`truncate ${r.isMe ? 'font-semibold' : 'font-medium'}`}>{r.label}</span>
                          {r.isMe && (
                            <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] rounded-full px-1.5">
                              me
                            </span>
                          )}
                        </span>
                      </td>
                      {insts.map((inst) => {
                        const a = cell(inst.id, r.id);
                        return (
                          <td key={inst.id} className="relative">
                            <UnitInput
                              ariaLabel={`${r.label} from installment ${formatShortDate(inst.date)}`}
                              value={a?.amount ?? 0}
                              unit={unit}
                              placeholder="–"
                              onChange={(v) => update({ allocations: setAllocation(plan, inst.id, r.id, v) })}
                              className={`${cellCls} ${a?.done ? '!bg-[var(--positive-soft)]' : ''}`}
                            />
                          </td>
                        );
                      })}
                      <td className="text-right pl-2 whitespace-nowrap">
                        <span className="block text-[13px] font-semibold num">{A(got)}</span>
                        <span
                          className={`block text-[11px] num ${
                            Math.abs(left) < 1
                              ? 'text-[var(--positive)]'
                              : left < 0
                                ? 'text-[var(--negative)]'
                                : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {Math.abs(left) < 1 ? (
                            <>✓ {A(r.target)}</>
                          ) : left > 0 ? (
                            <>{A(left)} left of {A(r.target)}</>
                          ) : (
                            <>{A(-left)} over</>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-10 bg-[var(--surface)] pr-2 pt-2 text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--text-faint)]">
                    Unassigned
                  </td>
                  {insts.map((inst) => {
                    const free = inst.amount - (s.allocatedByInstallment[inst.id] ?? 0);
                    return (
                      <td
                        key={inst.id}
                        className={`pt-2 text-right px-2 text-[12px] num ${
                          Math.abs(free) < 1
                            ? 'text-[var(--positive)]'
                            : free < 0
                              ? 'text-[var(--negative)]'
                              : 'text-[var(--warning)]'
                        }`}
                      >
                        {Math.abs(free) < 1 ? '✓' : free < 0 ? <>− {A(-free)}</> : A(free)}
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insts.map((inst, idx) => {
              const rows = plan.allocations.filter((a) => a.installmentId === inst.id && a.amount > 0);
              const free = inst.amount - (s.allocatedByInstallment[inst.id] ?? 0);
              return (
                <div key={inst.id} className="rounded-[14px] border border-[var(--border)] p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                      #{idx + 1} · {formatShortDate(inst.date)}
                    </p>
                    <p className="text-sm num font-semibold">{A(inst.amount)}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {rows.length === 0 && <li className="text-xs text-[var(--text-muted)]">Nothing assigned yet.</li>}
                    {rows.map((a) => {
                      const r = s.recipients.find((x) => x.id === a.to);
                      return (
                        <li key={a.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={!!a.done}
                            onChange={(v) =>
                              update({
                                allocations: plan.allocations.map((x) => (x.id === a.id ? { ...x, done: v } : x)),
                              })
                            }
                          />
                          <span className={`flex-1 truncate ${a.done ? 'line-through text-[var(--text-muted)]' : ''}`}>
                            {r?.label ?? '—'}
                          </span>
                          <span className="num">{A(a.amount)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {Math.abs(free) >= 1 && (
                    <p className={`mt-2 text-[11px] ${free < 0 ? 'text-[var(--negative)]' : 'text-[var(--warning)]'}`}>
                      {free < 0 ? <>Over by {A(-free)}</> : <>{A(free)} not assigned</>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-faint)]">
          Tip: type <span className="num">2.5</span> for {UNIT_LABEL[unit] === '₨' ? '₨2.5' : `2.5 ${UNIT_LABEL[unit]}`}, or{' '}
          <span className="num">250k</span>, <span className="num">3 lac</span>, <span className="num">1.2m</span>. In “By
          installment”, tick a payment once it's handed over.
        </p>
      </SectionCard>

      {resetDialog}
    </div>
  );
}
