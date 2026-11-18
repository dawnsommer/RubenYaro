import { ReactNode, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costMaybeExtra,
  costPaid,
  costSource,
  costTotal,
  subCostTotalPkr,
} from '../../store/selectors';
import {
  computeBreakdown,
  getConversionContext,
  moneyToPkr,
  pkrToUsd,
} from '../../lib/currency';
import { parseAmount } from '../../lib/parseAmount';
import { formatShortDate } from '../../lib/dates';
import { ConversionMode, Cost, CostVariant, Money, Priority, SubCost } from '../../types';
import {
  Amount,
  Button,
  DateInput,
  Dialog,
  MoneyInput,
  Progress,
  Segmented,
  Select,
  Switch,
} from '../../components/ui';
import { todayIso } from './costUi';

export interface CostEditorProps {
  cost: Cost;
  onClose: () => void;
}

/** Small labelled block used inside the editor. */
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="label-micro">{title}</p>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Pill-style toggle (used for In plan / Maybe / Estimate). */
function TogglePill({
  on,
  onChange,
  label,
  tone = 'accent',
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: 'accent' | 'maybe' | 'warning';
}) {
  const onCls =
    tone === 'maybe'
      ? 'bg-[var(--maybe-soft)] text-[var(--maybe)] border-transparent'
      : tone === 'warning'
        ? 'bg-[var(--warning-soft)] text-[var(--warning)] border-transparent'
        : 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
        on
          ? onCls
          : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
      }`}
    >
      <span
        className={`grid place-items-center w-3.5 h-3.5 rounded-full border ${
          on ? 'border-current bg-current' : 'border-[var(--border-strong)]'
        }`}
      >
        {on && <Check className="w-2.5 h-2.5 text-[var(--surface)]" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

export function CostEditor({ cost, onClose }: CostEditorProps) {
  const state = useStore();
  const { settings, accounts, transactions } = state;
  const ctx = getConversionContext(settings);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const [payAccountId, setPayAccountId] = useState<string>(activeAccounts[0]?.id ?? '');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState<string | null>(todayIso());

  const [newSubName, setNewSubName] = useState('');
  const [newSubMoney, setNewSubMoney] = useState<Money>({
    amount: 0,
    currency: cost.money.currency,
  });

  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const src = costSource(cost);
  const hasVariants = Boolean(cost.variants && cost.variants.length > 0);
  const activeVariantId = hasVariants ? (cost.activeVariantId ?? cost.variants![0].id) : null;

  const totalPkr = costTotal(cost, settings);
  const maybeExtraPkr = costMaybeExtra(cost, settings);
  const paidPkr = costPaid(cost, transactions, accounts, settings);
  const remainingPkr = Math.max(0, totalPkr - paidPkr);
  const paidPct = totalPkr > 0 ? Math.min(100, (paidPkr / totalPkr) * 100) : 0;
  const payments = transactions
    .filter((t) => t.type === 'payment' && t.costId === cost.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const update = (patch: Partial<Cost>) => state.updateCost(cost.id, patch);

  // ---- variant-aware helpers -------------------------------------------------
  const patchActiveVariant = (fn: (v: CostVariant) => CostVariant) => {
    if (!cost.variants) return;
    update({ variants: cost.variants.map((v) => (v.id === activeVariantId ? fn(v) : v)) });
  };

  const setMoney = (money: Money) => {
    if (hasVariants) patchActiveVariant((v) => ({ ...v, money }));
    else update({ money });
  };

  const updateSub = (subId: string, patch: Partial<SubCost>) => {
    if (hasVariants) {
      patchActiveVariant((v) => ({
        ...v,
        subCosts: v.subCosts.map((sc) => (sc.id === subId ? { ...sc, ...patch } : sc)),
      }));
    } else {
      state.updateSubCost(cost.id, subId, patch);
    }
  };

  const deleteSub = (subId: string) => {
    if (hasVariants) {
      patchActiveVariant((v) => ({ ...v, subCosts: v.subCosts.filter((sc) => sc.id !== subId) }));
    } else {
      state.deleteSubCost(cost.id, subId);
    }
  };

  const addSub = () => {
    const name = newSubName.trim();
    if (!name) return;
    if (hasVariants) {
      patchActiveVariant((v) => ({
        ...v,
        subCosts: [
          ...v.subCosts,
          {
            id: nanoid(10),
            name,
            money: newSubMoney,
            kind: 'fixed',
            order: v.subCosts.length,
            included: true,
            maybe: false,
          },
        ],
      }));
    } else {
      state.addSubCost(cost.id, { name, money: newSubMoney, kind: 'fixed' });
    }
    setNewSubName('');
    setNewSubMoney({ amount: 0, currency: newSubMoney.currency });
  };

  const addOption = () => {
    const existing: CostVariant[] = hasVariants
      ? cost.variants!
      : [
          {
            id: nanoid(10),
            name: 'Option 1',
            money: cost.money,
            range: cost.range,
            subCosts: cost.subCosts,
          },
        ];
    const next: CostVariant = {
      id: nanoid(10),
      name: `Option ${existing.length + 1}`,
      money: { ...src.money },
      subCosts: [],
    };
    update({ variants: [...existing, next], activeVariantId: next.id });
  };

  const removeOption = (id: string) => {
    if (!cost.variants) return;
    const rest = cost.variants.filter((v) => v.id !== id);
    if (rest.length <= 1) {
      // Collapse back to a plain cost using the remaining option
      const keep = rest[0];
      update({
        variants: undefined,
        activeVariantId: undefined,
        ...(keep ? { money: keep.money, range: keep.range, subCosts: keep.subCosts } : {}),
      });
    } else {
      update({
        variants: rest,
        activeVariantId: activeVariantId === id ? rest[0].id : activeVariantId ?? undefined,
      });
    }
  };

  // ---- payments --------------------------------------------------------------
  const payAccount = activeAccounts.find((a) => a.id === payAccountId) ?? activeAccounts[0];
  const remainingInAcc = payAccount
    ? payAccount.currency === 'PKR'
      ? remainingPkr
      : pkrToUsd(
          remainingPkr,
          cost.conversionMode ?? settings.defaultConversionMode,
          settings.rates.market,
          settings.rates.effective,
          cost.tax ?? settings.defaultTax
        )
    : 0;

  const recordPayment = () => {
    if (!payAccount) return;
    const amt = payAmount.trim()
      ? (parseAmount(payAmount) ?? 0)
      : Math.round(remainingInAcc * 100) / 100;
    if (amt <= 0) return;
    state.addTransaction({
      type: 'payment',
      date: payDate ?? todayIso(),
      accountId: payAccount.id,
      costId: cost.id,
      amount: amt,
      note: `Payment for ${cost.name}`,
    });
    setPayAmount('');
  };

  // ---- breakdown -------------------------------------------------------------
  const breakdowns = [
    { title: 'Market', b: computeBreakdown(src.money, ctx, 'market') },
    { title: `Card ×${settings.rates.effective}`, b: computeBreakdown(src.money, ctx, 'effective') },
    {
      title: 'Market + tax',
      b: computeBreakdown(src.money, ctx, 'detailed', cost.tax ?? settings.defaultTax),
    },
  ];

  const lowestVariantId = (() => {
    if (!cost.variants || cost.variants.length < 2) return null;
    const totals = cost.variants.map((v) => ({
      id: v.id,
      pkr:
        v.subCosts.length > 0
          ? v.subCosts
              .filter((s) => s.included && !s.maybe)
              .reduce((s, sc) => s + moneyToPkr(sc.money, ctx), 0)
          : moneyToPkr(v.money, ctx),
    }));
    const min = Math.min(...totals.map((t) => t.pkr));
    const lows = totals.filter((t) => Math.round(t.pkr) === Math.round(min));
    return lows.length === 1 ? lows[0].id : null;
  })();

  return (
    <div className="animate-fade-up space-y-6 px-4 sm:px-5 pt-1 pb-5">
      {/* Name + amount */}
      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Name</label>
          <input
            type="text"
            value={cost.name}
            onChange={(e) => update({ name: e.target.value })}
            className="field font-medium"
          />
        </div>
        {src.subCosts.length > 0 ? (
          <div>
            <p className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Total (sum of items)
            </p>
            <div className="field !bg-[var(--surface-2)] font-semibold num">
              <Amount pkr={totalPkr} showSecondary />
            </div>
          </div>
        ) : (
          <MoneyInput
            label={cost.recurrence ? 'Amount each time' : 'Amount'}
            value={src.money}
            onChange={setMoney}
            conversionMode={cost.conversionMode}
            tax={cost.tax}
          />
        )}
      </div>

      {/* Options (variants) */}
      {hasVariants && (
        <Section title="Pricing options" aside={<span className="text-xs text-[var(--text-faint)]">Only the selected one counts</span>}>
          <div className="flex flex-wrap gap-2">
            {cost.variants!.map((v) => {
              const active = v.id === activeVariantId;
              const vPkr =
                v.subCosts.length > 0
                  ? v.subCosts
                      .filter((s) => s.included && !s.maybe)
                      .reduce((s, sc) => s + moneyToPkr(sc.money, ctx), 0)
                  : moneyToPkr(v.money, ctx);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => update({ activeVariantId: v.id })}
                  className={`text-left rounded-[14px] border px-3.5 py-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                    {v.name}
                    {lowestVariantId === v.id && (
                      <span className="text-[10px] font-semibold text-[var(--positive)]">LOWEST</span>
                    )}
                  </span>
                  <span className="block text-sm font-semibold num mt-0.5">
                    <Amount pkr={vPkr} />
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Basics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="Phase"
          value={cost.phaseId}
          onChange={(phaseId) => update({ phaseId })}
          options={settings.phases.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          label="Category"
          value={cost.categoryId}
          onChange={(categoryId) => update({ categoryId })}
          options={settings.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <DateInput
          label="Due date"
          value={cost.dueDate ?? null}
          onChange={(d) => update({ dueDate: d ?? undefined })}
        />
        <div>
          <p className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Priority</p>
          <Segmented
            options={[
              { value: 'must', label: 'Must' },
              { value: 'should', label: 'Should' },
              { value: 'nice', label: 'Nice' },
            ]}
            value={cost.priority}
            onChange={(p) => update({ priority: p as Priority })}
            className="w-full justify-between [&>button]:flex-1 !py-[3px] h-[38px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TogglePill on={cost.included} onChange={(included) => update({ included })} label="Counts in plan" />
        <TogglePill on={cost.maybe} onChange={(maybe) => update({ maybe })} label="Maybe" tone="maybe" />
        <TogglePill
          on={cost.kind === 'estimate'}
          onChange={(on) => update({ kind: on ? 'estimate' : 'fixed' })}
          label="Estimate"
          tone="warning"
        />
        {cost.verify && (
          <button
            type="button"
            onClick={() => update({ verify: false })}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-[var(--warning-soft)] text-[var(--warning)] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Mark price verified
          </button>
        )}
      </div>

      {/* Items (sub-costs) */}
      <Section
        title={`Items${src.subCosts.length ? ` · ${src.subCosts.length}` : ''}`}
        aside={
          maybeExtraPkr > 0 ? (
            <span className="text-xs text-[var(--maybe)] num">
              + maybe <Amount pkr={maybeExtraPkr} compact tone="muted" />
            </span>
          ) : undefined
        }
      >
        <div className="rounded-[14px] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          {src.subCosts.map((sc) => {
            const scPkr = subCostTotalPkr(cost, sc, settings);
            return (
              <div
                key={sc.id}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2 ${
                  !sc.included ? 'opacity-50' : ''
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={sc.included}
                  aria-label="Include item"
                  onClick={() => updateSub(sc.id, { included: !sc.included })}
                  className={`grid place-items-center w-[18px] h-[18px] rounded-[6px] border-2 shrink-0 cursor-pointer ${
                    sc.included
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border-strong)]'
                  }`}
                >
                  {sc.included && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>
                <input
                  type="text"
                  value={sc.name}
                  onChange={(e) => updateSub(sc.id, { name: e.target.value })}
                  className={`flex-1 min-w-[120px] bg-transparent text-sm outline-none ${
                    !sc.included ? 'line-through' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => updateSub(sc.id, { maybe: !sc.maybe })}
                  className={`h-6 px-2 rounded-full text-[11px] font-medium cursor-pointer shrink-0 ${
                    sc.maybe
                      ? 'bg-[var(--maybe-soft)] text-[var(--maybe)]'
                      : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
                  }`}
                >
                  {sc.maybe ? 'Maybe' : 'Sure'}
                </button>
                <MoneyInput
                  compact
                  value={sc.money}
                  onChange={(money) => updateSub(sc.id, { money })}
                  className="w-[170px] shrink-0"
                />
                <span className="hidden md:block w-24 text-right text-xs text-[var(--text-muted)] num shrink-0">
                  <Amount pkr={scPkr} compact tone="muted" />
                </span>
                <button
                  type="button"
                  onClick={() => deleteSub(sc.id)}
                  aria-label="Remove item"
                  className="w-7 h-7 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2 bg-[var(--surface-2)]/50">
            <Plus className="w-[18px] h-[18px] text-[var(--text-faint)] shrink-0" />
            <input
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
              placeholder={src.subCosts.length ? 'Add another item…' : 'Split into items (e.g. Exam fee, Surcharge)…'}
              className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
            />
            <MoneyInput
              compact
              value={newSubMoney}
              onChange={setNewSubMoney}
              onEnter={addSub}
              className="w-[170px] shrink-0"
            />
            <Button size="sm" variant="secondary" onClick={addSub} disabled={!newSubName.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Section>

      {/* Payments */}
      <Section
        title="Payments"
        aside={
          <span className="text-xs text-[var(--text-muted)] num">
            <Amount pkr={paidPkr} tone="positive" /> of <Amount pkr={totalPkr} />
          </span>
        }
      >
        <Progress value={paidPct} tone="positive" />
        {activeAccounts.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            Add an account under <strong>Money</strong> to record payments.
          </p>
        ) : remainingPkr > 0.5 ? (
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="From"
              value={payAccount?.id ?? ''}
              onChange={setPayAccountId}
              options={activeAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
              className="flex-1 min-w-[160px]"
            />
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                Amount ({payAccount?.currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && recordPayment()}
                placeholder={Math.round(remainingInAcc).toLocaleString('en-US')}
                className="field num"
              />
            </div>
            <DateInput label="Date" value={payDate} onChange={setPayDate} className="w-[150px]" />
            <Button onClick={recordPayment} className="h-[38px]">
              {payAmount.trim() ? 'Record' : 'Pay remaining'}
            </Button>
          </div>
        ) : (
          <p className="text-xs font-medium text-[var(--positive)]">Fully paid 🎉</p>
        )}
        {payments.length > 0 && (
          <ul className="text-xs divide-y divide-[var(--border)]">
            {payments.map((p) => {
              const acc = accounts.find((a) => a.id === p.accountId);
              const curr = acc?.currency ?? 'PKR';
              const pkrVal = moneyToPkr({ amount: p.amount, currency: curr }, ctx, 'effective');
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-[var(--text-muted)]">
                    {formatShortDate(p.date)} · {acc?.name ?? 'Account'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Amount
                      pkr={pkrVal}
                      usd={curr === 'USD' ? p.amount : undefined}
                      displayCurrency={curr}
                      tone="positive"
                      className="font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => state.deleteTransaction(p.id)}
                      aria-label="Delete payment"
                      className="w-6 h-6 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* More options */}
      <div className="rounded-[14px] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer"
        >
          <span>More options</span>
          <span className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <span className="hidden sm:inline">range · repeat · window · options · rate · notes</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {moreOpen && (
          <div className="px-4 pb-4 space-y-5 border-t border-[var(--border)] pt-4 animate-fade-in">
            {cost.kind === 'estimate' && (
              <div className="grid grid-cols-2 gap-3">
                {(['low', 'high'] as const).map((k) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                      Estimate {k} ({src.money.currency})
                    </label>
                    <input
                      type="number"
                      value={src.range?.[k] ?? ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        const low = k === 'low' ? v : (src.range?.low ?? src.money.amount);
                        const high = k === 'high' ? v : (src.range?.high ?? src.money.amount);
                        update({ range: { low, high } });
                      }}
                      className="field num"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <Switch
                checked={Boolean(cost.recurrence)}
                onChange={(on) =>
                  update({
                    recurrence: on
                      ? { frequency: 'monthly', interval: 1, occurrences: 3, startDate: todayIso() }
                      : undefined,
                  })
                }
                label="Repeats (subscription, rent…)"
              />
              {cost.recurrence && (
                <div className="grid grid-cols-3 gap-3">
                  <Select
                    label="Every"
                    value={cost.recurrence.frequency}
                    onChange={(f) =>
                      update({
                        recurrence: { ...cost.recurrence!, frequency: f as 'weekly' | 'monthly' | 'yearly' },
                      })
                    }
                    options={[
                      { value: 'weekly', label: 'Week' },
                      { value: 'monthly', label: 'Month' },
                      { value: 'yearly', label: 'Year' },
                    ]}
                  />
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Times</label>
                    <input
                      type="number"
                      min="1"
                      value={cost.recurrence.occurrences}
                      onChange={(e) =>
                        update({
                          recurrence: {
                            ...cost.recurrence!,
                            occurrences: Math.max(1, parseInt(e.target.value, 10) || 1),
                          },
                        })
                      }
                      className="field num"
                    />
                  </div>
                  <DateInput
                    label="Starting"
                    value={cost.recurrence.startDate}
                    onChange={(d) =>
                      update({ recurrence: { ...cost.recurrence!, startDate: d ?? cost.recurrence!.startDate } })
                    }
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Switch
                checked={Boolean(cost.temporary)}
                onChange={(on) =>
                  update({ temporary: on ? { start: todayIso(), end: '2027-06-01' } : undefined })
                }
                label="Only counts between two dates"
              />
              {cost.temporary && (
                <div className="grid grid-cols-2 gap-3">
                  <DateInput
                    label="From"
                    value={cost.temporary.start}
                    onChange={(s) =>
                      update({ temporary: { start: s ?? cost.temporary!.start, end: cost.temporary!.end } })
                    }
                  />
                  <DateInput
                    label="Until"
                    value={cost.temporary.end}
                    onChange={(e) =>
                      update({ temporary: { start: cost.temporary!.start, end: e ?? cost.temporary!.end } })
                    }
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm">Alternative pricing options</p>
                <Button size="sm" variant="secondary" onClick={addOption}>
                  <Plus className="w-3.5 h-3.5" /> Add option
                </Button>
              </div>
              {hasVariants &&
                cost.variants!.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) =>
                        update({
                          variants: cost.variants!.map((x) =>
                            x.id === v.id ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                      className="field !py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(v.id)}
                      aria-label="Remove option"
                      className="w-8 h-8 grid place-items-center rounded-full text-[var(--text-faint)] hover:text-[var(--negative)] hover:bg-[var(--negative-soft)] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>

            <div className="space-y-2">
              <Select
                label="Conversion for this cost"
                value={cost.conversionMode ?? 'default'}
                onChange={(v) =>
                  update({ conversionMode: v === 'default' ? undefined : (v as ConversionMode) })
                }
                options={[
                  { value: 'default', label: `Default (${settings.defaultConversionMode})` },
                  { value: 'effective', label: `Card rate ₨${settings.rates.effective}` },
                  { value: 'market', label: `Market ₨${settings.rates.market}` },
                  { value: 'detailed', label: 'Market + tax' },
                ]}
              />
              {src.money.currency === 'USD' && src.money.amount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {breakdowns.map(({ title, b }) => (
                    <div key={title} className="rounded-[12px] bg-[var(--surface-2)] px-3 py-2">
                      <p className="text-[11px] text-[var(--text-muted)]">{title}</p>
                      <p className="text-sm font-semibold num">
                        <Amount pkr={b.totalPkr} usd={b.usd} displayCurrency="PKR" compact />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={cost.note ?? ''}
                  onChange={(e) => update({ note: e.target.value || undefined })}
                  className="field resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={cost.url ?? ''}
                    onChange={(e) => update({ url: e.target.value || undefined })}
                    placeholder="https://"
                    className="field"
                  />
                  {cost.url && (
                    <a
                      href={cost.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open link"
                      className="w-9 h-9 grid place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => update({ archived: !cost.archived })}>
            {cost.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {cost.archived ? 'Restore' : 'Archive'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="hover:!text-[var(--negative)]">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
        <Button size="sm" onClick={onClose}>
          <Check className="w-3.5 h-3.5" /> Done
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          state.deleteCost(cost.id);
          onClose();
        }}
        title={`Delete “${cost.name}”?`}
        description="This removes the cost and can't be undone. Archive it instead if you might need it later."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
