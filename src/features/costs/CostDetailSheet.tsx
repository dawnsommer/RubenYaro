import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Trash2, Plus, Archive, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costMaybeExtra,
  costPaid,
  costSource,
  costStatus,
  costTotal,
  subCostTotalPkr,
} from '../../store/selectors';
import { computeBreakdown, getConversionContext, pkrToUsd } from '../../lib/currency';
import {
  ConversionMode,
  Cost,
  CostKind,
  CostVariant,
  Priority,
  SubCost,
} from '../../types';
import {
  Amount,
  Button,
  Chip,
  DateInput,
  MoneyInput,
  Segmented,
  Select,
  Sheet,
  Switch,
} from '../../components/ui';
import { parseAmount } from '../../lib/parseAmount';

export type CostSheetTab = 'details' | 'subcosts' | 'payments' | 'breakdown';

export interface CostDetailSheetProps {
  cost: Cost | null;
  open: boolean;
  initialTab?: CostSheetTab;
  onClose: () => void;
}

export function CostDetailSheet({
  cost,
  open,
  initialTab = 'details',
  onClose,
}: CostDetailSheetProps) {
  const state = useStore();
  const { settings, accounts, transactions } = state;
  const [tab, setTab] = useState<CostSheetTab>(initialTab);

  // Payment form state
  const [payAccountId, setPayAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string | null>(
    new Date().toISOString().slice(0, 10)
  );
  const [payNote, setPayNote] = useState<string>('');

  // New sub-cost inline form
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState(0);
  const [newSubCurrency, setNewSubCurrency] = useState<'USD' | 'PKR'>('PKR');

  if (!cost) return null;

  const liveCost = state.costs.find((c) => c.id === cost.id) ?? cost;
  const src = costSource(liveCost);
  const totalPkr = costTotal(liveCost, settings);
  const maybeExtraPkr = costMaybeExtra(liveCost, settings);
  const paidPkr = costPaid(liveCost, transactions, accounts, settings);
  const remainingPkr = Math.max(0, totalPkr - paidPkr);
  const status = costStatus(liveCost, transactions, accounts, settings);
  const ctx = getConversionContext(settings);

  const linkedPayments = transactions.filter(
    (t) => t.type === 'payment' && t.costId === liveCost.id
  );

  const handleRecordPayment = () => {
    const targetAcc = accounts.find((a) => a.id === payAccountId) ?? accounts[0];
    if (!targetAcc) return;
    const defaultRemainingInAcc =
      targetAcc.currency === 'PKR'
        ? remainingPkr
        : pkrToUsd(
            remainingPkr,
            liveCost.conversionMode ?? settings.defaultConversionMode,
            settings.rates.market,
            settings.rates.effective,
            liveCost.tax ?? settings.defaultTax
          );

    const amt = payAmount.trim()
      ? parseAmount(payAmount) ?? 0
      : Math.round(defaultRemainingInAcc * 100) / 100;

    if (amt <= 0) return;

    state.addTransaction({
      type: 'payment',
      date: payDate ?? new Date().toISOString().slice(0, 10),
      accountId: targetAcc.id,
      costId: liveCost.id,
      amount: amt,
      note: payNote.trim() || `Payment for ${liveCost.name}`,
    });
    setPayAmount('');
    setPayNote('');
  };

  const handleAddSubCost = () => {
    if (!newSubName.trim()) return;
    if (liveCost.variants && liveCost.variants.length > 0) {
      const activeId = liveCost.activeVariantId ?? liveCost.variants[0].id;
      const updatedVariants = liveCost.variants.map((v) =>
        v.id === activeId
          ? {
              ...v,
              subCosts: [
                ...v.subCosts,
                {
                  id: nanoid(10),
                  name: newSubName.trim(),
                  money: { amount: newSubAmount, currency: newSubCurrency },
                  kind: 'fixed' as const,
                  order: v.subCosts.length,
                  included: true,
                  maybe: false,
                },
              ],
            }
          : v
      );
      state.updateCost(liveCost.id, { variants: updatedVariants });
    } else {
      state.addSubCost(liveCost.id, {
        name: newSubName.trim(),
        money: { amount: newSubAmount, currency: newSubCurrency },
        kind: 'fixed',
      });
    }
    setNewSubName('');
    setNewSubAmount(0);
  };

  const handleUpdateSubItem = (subId: string, patch: Partial<SubCost>) => {
    if (liveCost.variants && liveCost.variants.length > 0) {
      const activeId = liveCost.activeVariantId ?? liveCost.variants[0].id;
      const updatedVariants = liveCost.variants.map((v) =>
        v.id === activeId
          ? {
              ...v,
              subCosts: v.subCosts.map((sc) =>
                sc.id === subId ? { ...sc, ...patch } : sc
              ),
            }
          : v
      );
      state.updateCost(liveCost.id, { variants: updatedVariants });
    } else {
      state.updateSubCost(liveCost.id, subId, patch);
    }
  };

  const handleDeleteSubItem = (subId: string) => {
    if (liveCost.variants && liveCost.variants.length > 0) {
      const activeId = liveCost.activeVariantId ?? liveCost.variants[0].id;
      const updatedVariants = liveCost.variants.map((v) =>
        v.id === activeId
          ? {
              ...v,
              subCosts: v.subCosts.filter((sc) => sc.id !== subId),
            }
          : v
      );
      state.updateCost(liveCost.id, { variants: updatedVariants });
    } else {
      state.deleteSubCost(liveCost.id, subId);
    }
  };

  const handleAddVariantOption = () => {
    const existingVariants: CostVariant[] =
      liveCost.variants && liveCost.variants.length > 0
        ? liveCost.variants
        : [
            {
              id: nanoid(10),
              name: 'Option 1',
              money: liveCost.money,
              range: liveCost.range,
              subCosts: liveCost.subCosts,
            },
          ];

    const newVariant: CostVariant = {
      id: nanoid(10),
      name: `Option ${existingVariants.length + 1}`,
      money: { ...liveCost.money },
      subCosts: [],
    };

    const next = [...existingVariants, newVariant];
    state.updateCost(liveCost.id, {
      variants: next,
      activeVariantId: newVariant.id,
    });
  };

  const bdMarket = computeBreakdown(src.money, ctx, 'market');
  const bdEffective = computeBreakdown(src.money, ctx, 'effective');
  const bdDetailed = computeBreakdown(
    src.money,
    ctx,
    'detailed',
    liveCost.tax ?? settings.defaultTax
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>{liveCost.name}</span>
          <Chip
            variant={
              status === 'paid'
                ? 'positive'
                : status === 'overdue'
                  ? 'negative'
                  : status === 'due_soon' || status === 'partial'
                    ? 'warning'
                    : 'default'
            }
          >
            {status.replace('_', ' ')}
          </Chip>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                state.updateCost(liveCost.id, { archived: !liveCost.archived })
              }
            >
              <Archive className="w-3.5 h-3.5" />
              {liveCost.archived ? 'Unarchive' : 'Archive'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                state.deleteCost(liveCost.id);
                onClose();
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Segmented
          ariaLabel="Cost detail tabs"
          options={[
            { value: 'details', label: 'Details' },
            {
              value: 'subcosts',
              label: `Sub-costs (${src.subCosts.length})`,
            },
            {
              value: 'payments',
              label: `Payments (${linkedPayments.length})`,
            },
            { value: 'breakdown', label: 'Breakdown' },
          ]}
          value={tab}
          onChange={setTab}
          className="w-full justify-between"
        />

        {/* TAB 1: DETAILS */}
        {tab === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Name
              </label>
              <input
                type="text"
                value={liveCost.name}
                onChange={(e) =>
                  state.updateCost(liveCost.id, { name: e.target.value })
                }
                className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>

            {src.subCosts.length > 0 ? (
              <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">
                  Σ of {src.subCosts.filter((s) => s.included && !s.maybe).length} included
                  sub-costs
                </span>
                <span className="text-sm font-semibold num">
                  <Amount pkr={totalPkr} showSecondary />
                </span>
              </div>
            ) : (
              <MoneyInput
                label="Amount (per occurrence)"
                value={src.money}
                onChange={(nextMoney) => {
                  if (liveCost.variants && liveCost.variants.length > 0) {
                    const activeId =
                      liveCost.activeVariantId ?? liveCost.variants[0].id;
                    state.updateCost(liveCost.id, {
                      variants: liveCost.variants.map((v) =>
                        v.id === activeId ? { ...v, money: nextMoney } : v
                      ),
                    });
                  } else {
                    state.updateCost(liveCost.id, { money: nextMoney });
                  }
                }}
                conversionMode={liveCost.conversionMode}
                tax={liveCost.tax}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Kind
                </label>
                <Segmented
                  options={[
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'estimate', label: 'Estimate' },
                  ]}
                  value={liveCost.kind}
                  onChange={(k) =>
                    state.updateCost(liveCost.id, { kind: k as CostKind })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  Priority
                </label>
                <Segmented
                  options={[
                    { value: 'must', label: 'Must' },
                    { value: 'should', label: 'Should' },
                    { value: 'nice', label: 'Nice' },
                  ]}
                  value={liveCost.priority}
                  onChange={(p) =>
                    state.updateCost(liveCost.id, { priority: p as Priority })
                  }
                />
              </div>
            </div>

            {liveCost.kind === 'estimate' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Range Low ({src.money.currency})
                  </label>
                  <input
                    type="number"
                    value={src.range?.low ?? ''}
                    onChange={(e) => {
                      const low = parseFloat(e.target.value) || 0;
                      const high = src.range?.high ?? src.money.amount;
                      state.updateCost(liveCost.id, { range: { low, high } });
                    }}
                    className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Range High ({src.money.currency})
                  </label>
                  <input
                    type="number"
                    value={src.range?.high ?? ''}
                    onChange={(e) => {
                      const high = parseFloat(e.target.value) || 0;
                      const low = src.range?.low ?? src.money.amount;
                      state.updateCost(liveCost.id, { range: { low, high } });
                    }}
                    className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Phase"
                value={liveCost.phaseId}
                onChange={(phaseId) => state.updateCost(liveCost.id, { phaseId })}
                options={settings.phases.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
              />
              <Select
                label="Category"
                value={liveCost.categoryId}
                onChange={(categoryId) =>
                  state.updateCost(liveCost.id, { categoryId })
                }
                options={settings.categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </div>

            <DateInput
              label="Due date"
              value={liveCost.dueDate ?? null}
              onChange={(d) =>
                state.updateCost(liveCost.id, { dueDate: d ?? undefined })
              }
            />

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Switch
                checked={liveCost.included}
                onChange={(included) =>
                  state.updateCost(liveCost.id, { included })
                }
                label="Included in plan"
              />
              <Switch
                checked={liveCost.maybe}
                onChange={(maybe) => state.updateCost(liveCost.id, { maybe })}
                label="Maybe (uncertain)"
              />
              {liveCost.verify && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    state.updateCost(liveCost.id, { verify: false })
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                  Mark price verified
                </Button>
              )}
            </div>

            {/* Temporary window toggle */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <Switch
                checked={Boolean(liveCost.temporary)}
                onChange={(on) => {
                  if (on) {
                    const today = new Date().toISOString().slice(0, 10);
                    state.updateCost(liveCost.id, {
                      temporary: { start: today, end: '2027-06-01' },
                    });
                  } else {
                    state.updateCost(liveCost.id, { temporary: undefined });
                  }
                }}
                label="Temporary cost (only counts inside window)"
              />
              {liveCost.temporary && (
                <div className="grid grid-cols-2 gap-3">
                  <DateInput
                    label="Start"
                    value={liveCost.temporary.start}
                    onChange={(s) =>
                      state.updateCost(liveCost.id, {
                        temporary: {
                          start: s ?? liveCost.temporary!.start,
                          end: liveCost.temporary!.end,
                        },
                      })
                    }
                  />
                  <DateInput
                    label="End"
                    value={liveCost.temporary.end}
                    onChange={(e) =>
                      state.updateCost(liveCost.id, {
                        temporary: {
                          start: liveCost.temporary!.start,
                          end: e ?? liveCost.temporary!.end,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* Recurrence toggle */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <Switch
                checked={Boolean(liveCost.recurrence)}
                onChange={(on) => {
                  if (on) {
                    state.updateCost(liveCost.id, {
                      recurrence: {
                        frequency: 'monthly',
                        interval: 1,
                        occurrences: 5,
                        startDate: new Date().toISOString().slice(0, 10),
                      },
                    });
                  } else {
                    state.updateCost(liveCost.id, { recurrence: undefined });
                  }
                }}
                label="Recurring subscription / multi-month stay"
              />
              {liveCost.recurrence && (
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    label="Frequency"
                    value={liveCost.recurrence.frequency}
                    onChange={(f) =>
                      state.updateCost(liveCost.id, {
                        recurrence: {
                          ...liveCost.recurrence!,
                          frequency: f as 'weekly' | 'monthly' | 'yearly',
                        },
                      })
                    }
                    options={[
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'yearly', label: 'Yearly' },
                    ]}
                  />
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Occurrences (×N)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={liveCost.recurrence.occurrences}
                      onChange={(e) =>
                        state.updateCost(liveCost.id, {
                          recurrence: {
                            ...liveCost.recurrence!,
                            occurrences: Math.max(1, parseInt(e.target.value, 10) || 1),
                          },
                        })
                      }
                      className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
                    />
                  </div>
                  <DateInput
                    label="Start date"
                    value={liveCost.recurrence.startDate}
                    onChange={(d) =>
                      state.updateCost(liveCost.id, {
                        recurrence: {
                          ...liveCost.recurrence!,
                          startDate: d ?? liveCost.recurrence!.startDate,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* Conversion mode override */}
            <div className="pt-2 border-t border-[var(--border)]">
              <Select
                label="Conversion mode override"
                value={liveCost.conversionMode ?? 'default'}
                onChange={(v) =>
                  state.updateCost(liveCost.id, {
                    conversionMode:
                      v === 'default' ? undefined : (v as ConversionMode),
                  })
                }
                options={[
                  { value: 'default', label: `Default (${settings.defaultConversionMode})` },
                  { value: 'effective', label: `Card rate (₨${settings.rates.effective})` },
                  { value: 'market', label: `Market rate (₨${settings.rates.market})` },
                  { value: 'detailed', label: 'Detailed (market + tax)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={liveCost.note ?? ''}
                onChange={(e) =>
                  state.updateCost(liveCost.id, { note: e.target.value || undefined })
                }
                className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        )}

        {/* TAB 2: SUB-COSTS & OPTIONS */}
        {tab === 'subcosts' && (
          <div className="space-y-4">
            {/* Variants switcher / add option */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Pricing variants / options
              </span>
              <Button size="sm" variant="secondary" onClick={handleAddVariantOption}>
                <Plus className="w-3.5 h-3.5" />
                Add option
              </Button>
            </div>

            {liveCost.variants && liveCost.variants.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {liveCost.variants.map((v) => {
                  const isActive =
                    (liveCost.activeVariantId ?? liveCost.variants![0].id) === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`p-3 rounded-[12px] border ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40'
                          : 'border-[var(--border)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => {
                            const updated = liveCost.variants!.map((item) =>
                              item.id === v.id ? { ...item, name: e.target.value } : item
                            );
                            state.updateCost(liveCost.id, { variants: updated });
                          }}
                          className="text-sm font-semibold bg-transparent outline-none min-w-0 flex-1"
                        />
                        <Button
                          size="sm"
                          variant={isActive ? 'primary' : 'secondary'}
                          onClick={() =>
                            state.updateCost(liveCost.id, { activeVariantId: v.id })
                          }
                        >
                          {isActive ? 'Active' : 'Use this'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-costs list */}
            <div className="space-y-2">
              {src.subCosts.map((sc) => {
                const scPkr = subCostTotalPkr(liveCost, sc, settings);
                return (
                  <div
                    key={sc.id}
                    className={`p-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] space-y-2 ${
                      !sc.included ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={sc.name}
                        onChange={(e) =>
                          handleUpdateSubItem(sc.id, { name: e.target.value })
                        }
                        className="text-sm font-medium bg-transparent outline-none flex-1"
                      />
                      <span className="text-sm font-semibold num">
                        <Amount
                          pkr={scPkr}
                          prefix={sc.maybe ? '+' : ''}
                          tone={sc.maybe ? 'muted' : 'default'}
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubItem(sc.id)}
                        aria-label="Delete sub-cost"
                        className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={sc.included}
                          onChange={(included) =>
                            handleUpdateSubItem(sc.id, { included })
                          }
                          label="Include"
                        />
                        <Switch
                          checked={sc.maybe}
                          onChange={(maybe) => handleUpdateSubItem(sc.id, { maybe })}
                          label="Maybe"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add sub-cost form */}
            <div className="p-3 rounded-[12px] border border-dashed border-[var(--border)] space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                + Add sub-cost
              </p>
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Sub-cost name (e.g. Exam fee, Surcharge)"
                className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none"
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <MoneyInput
                    value={{ amount: newSubAmount, currency: newSubCurrency }}
                    onChange={(m) => {
                      setNewSubAmount(m.amount);
                      setNewSubCurrency(m.currency);
                    }}
                  />
                </div>
                <Button size="sm" onClick={handleAddSubCost}>
                  Add
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-[12px] bg-[var(--surface-2)] flex items-center justify-between text-xs font-medium num">
              <span>Confirmed Σ:</span>
              <span>
                <Amount pkr={totalPkr} />
                {maybeExtraPkr > 0 && (
                  <span className="text-[var(--text-muted)] ml-1.5">
                    + maybe <Amount pkr={maybeExtraPkr} tone="muted" />
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Paid so far</p>
                <p className="font-semibold num">
                  <Amount pkr={paidPkr} tone="positive" /> / <Amount pkr={totalPkr} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">Remaining</p>
                <p className="font-semibold num">
                  <Amount pkr={remainingPkr} />
                </p>
              </div>
            </div>

            {accounts.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Add an account in the Accounts screen first to record a payment.
              </p>
            ) : (
              <div className="p-3.5 rounded-[12px] border border-[var(--border)] space-y-3">
                <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                  Record payment
                </p>
                <Select
                  label="Pay from account"
                  value={payAccountId || accounts[0].id}
                  onChange={setPayAccountId}
                  options={accounts
                    .filter((a) => !a.archived)
                    .map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.currency})`,
                    }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Amount (leave blank for full remaining)
                    </label>
                    <input
                      type="text"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="Auto remaining"
                      className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
                    />
                  </div>
                  <DateInput label="Date" value={payDate} onChange={setPayDate} />
                </div>
                <Button onClick={handleRecordPayment} className="w-full">
                  Record payment
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Payment history
              </p>
              {linkedPayments.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-3">
                  No payments recorded yet.
                </p>
              ) : (
                linkedPayments.map((p) => {
                  const acc = accounts.find((a) => a.id === p.accountId);
                  const curr = acc?.currency ?? 'PKR';
                  const pkrVal =
                    curr === 'PKR' ? p.amount : p.amount * settings.rates.effective;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--surface-2)] text-xs"
                    >
                      <div>
                        <p className="font-medium">{acc?.name ?? 'Account'}</p>
                        <p className="text-[var(--text-muted)] num">{p.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Amount
                          pkr={pkrVal}
                          usd={curr === 'USD' ? p.amount : undefined}
                          displayCurrency={curr}
                          tone="positive"
                        />
                        <button
                          type="button"
                          onClick={() => state.deleteTransaction(p.id)}
                          aria-label="Delete payment"
                          className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: BREAKDOWN (§5.3 side-by-side comparison) */}
        {tab === 'breakdown' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Side-by-side comparison across all 3 conversion modes for single occurrence:
            </p>
            {(
              [
                { title: 'Market mode (interbank)', b: bdMarket },
                { title: `Card / Effective mode (₨${settings.rates.effective})`, b: bdEffective },
                { title: 'Detailed mode (Market + Tax)', b: bdDetailed },
              ] as const
            ).map(({ title, b }) => (
              <div
                key={title}
                className="p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{title}</span>
                  <span className="text-sm font-semibold num">
                    <Amount pkr={b.totalPkr} usd={b.usd} />
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] num">
                  Base: <Amount pkr={b.marketPkr} displayCurrency="PKR" tone="muted" /> ·
                  Tax/Markup: <Amount pkr={b.tax} displayCurrency="PKR" tone="muted" /> ·
                  Effective rate: ₨{b.rateUsed.toFixed(2)}/USD
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
