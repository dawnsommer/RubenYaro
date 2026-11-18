import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Clock,
  Repeat,
  AlertCircle,
  Download,
  MoreHorizontal,
  Receipt,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costEffectivePkr,
  costMarketPkr,
  costMaybeExtra,
  costNativeUsd,
  costPaid,
  costSource,
  costStatus,
  costTotal,
  isCostExpired,
  subCostTotalPkr,
} from '../../store/selectors';
import { getConversionContext, moneyToPkr } from '../../lib/currency';
import {
  formatMonthYear,
  formatShortDate,
  generateRecurrenceDates,
} from '../../lib/dates';
import { buildCostsCsv, downloadTextFile } from '../../lib/csv';
import { Cost, CostKind, Currency, Priority } from '../../types';
import {
  Amount,
  Button,
  Card,
  Chip,
  EmptyState,
  MoneyInput,
  Progress,
  Segmented,
  Select,
  Sheet,
  Switch,
} from '../../components/ui';
import { CostDetailSheet, CostSheetTab } from './CostDetailSheet';

type CostViewMode = 'phase' | 'category' | 'timeline' | 'table';

interface SortableCostRowProps {
  cost: Cost;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenDetail: (tab?: CostSheetTab) => void;
}

function SortableCostRow({
  cost,
  expanded,
  onToggleExpand,
  onOpenDetail,
}: SortableCostRowProps) {
  const state = useStore();
  const { settings, transactions, accounts } = state;

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: cost.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const src = costSource(cost);
  const marketPkr = costMarketPkr(cost, settings);
  const afterTaxPkr = costEffectivePkr(cost, settings);
  const nativeUsd = costNativeUsd(cost);
  const totalPkr = marketPkr;
  const maybeExtraPkr = costMaybeExtra(cost, settings, 'market');
  const paidPkr = costPaid(cost, transactions, accounts, settings);
  const status = costStatus(cost, transactions, accounts, settings);
  const expired = isCostExpired(cost);
  const category = settings.categories.find((c) => c.id === cost.categoryId);
  const paidPct = totalPkr > 0 ? Math.min(100, (paidPkr / totalPkr) * 100) : 0;
  const ctx = getConversionContext(settings);

  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState('');
  const [subMoney, setSubMoney] = useState<{ amount: number; currency: Currency }>({
    amount: 0,
    currency: 'PKR',
  });

  // Determine lowest variant id if variants exist
  const variantTotals = useMemo(() => {
    if (!cost.variants || cost.variants.length === 0) return [];
    return cost.variants.map((v) => {
      const pkr =
        v.subCosts.length > 0
          ? v.subCosts
              .filter((sc) => sc.included && !sc.maybe)
              .reduce((s, sc) => s + moneyToPkr(sc.money, ctx), 0)
          : moneyToPkr(v.money, ctx);
      return { id: v.id, name: v.name, pkr };
    });
  }, [cost.variants, ctx]);

  const lowestVariantId = useMemo(() => {
    if (variantTotals.length < 2) return null;
    return variantTotals.reduce((min, cur) => (cur.pkr < min.pkr ? cur : min)).id;
  }, [variantTotals]);

  const handleAddInlineSub = () => {
    if (!subName.trim()) return;
    state.addSubCost(cost.id, {
      name: subName.trim(),
      money: subMoney,
      kind: 'fixed',
    });
    setSubName('');
    setSubMoney({ amount: 0, currency: 'PKR' });
    setAddingSub(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-4 py-3 transition-opacity ${
        !cost.included || expired ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder cost"
          className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: category?.color ?? '#6366F1' }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {src.subCosts.length > 0 && (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-label="Expand sub-costs"
                className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenDetail('details')}
              className={`font-medium text-sm text-left hover:underline cursor-pointer ${
                !cost.included ? 'line-through' : ''
              }`}
            >
              {cost.name}
            </button>

            <Chip variant={cost.kind === 'estimate' ? 'estimate' : 'default'}>
              {cost.kind === 'estimate' ? '≈ Estimate' : 'Fixed'}
            </Chip>

            <Chip>{cost.priority}</Chip>

            {/* Maybe chip — clicking toggles Maybe <-> Confirmed (§6.2) */}
            <button
              type="button"
              onClick={() => state.updateCost(cost.id, { maybe: !cost.maybe })}
              title="Click to toggle Maybe / Confirmed"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border border-dashed cursor-pointer ${
                cost.maybe
                  ? 'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/10'
                  : 'border-[var(--border)] text-[var(--text-muted)] opacity-60 hover:opacity-100'
              }`}
            >
              ? {cost.maybe ? 'Maybe' : 'Confirm'}
            </button>

            {cost.temporary && (
              <Chip variant={expired ? 'negative' : 'default'}>
                <Clock className="w-3 h-3" />
                {expired
                  ? 'Expired'
                  : `${cost.temporary.start} → ${cost.temporary.end}`}
              </Chip>
            )}

            {cost.recurrence && (
              <Chip>
                <Repeat className="w-3 h-3" />
                {cost.recurrence.frequency} ×{cost.recurrence.occurrences}
              </Chip>
            )}

            {cost.verify && (
              <Chip variant="warning">
                <AlertCircle className="w-3 h-3" />
                Verify price
              </Chip>
            )}

            {status !== 'planned' && (
              <Chip
                variant={
                  status === 'paid'
                    ? 'positive'
                    : status === 'overdue'
                      ? 'negative'
                      : 'warning'
                }
              >
                {status.replace('_', ' ')}
              </Chip>
            )}
          </div>

          {/* Sub-line: due date, Σ of sub-costs, range, or variants switcher */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
            {cost.dueDate && <span>Due {formatShortDate(cost.dueDate)}</span>}
            {src.subCosts.length > 0 && (
              <span title="Parent total equals the sum of included sub-costs">
                Σ of {src.subCosts.filter((s) => s.included && !s.maybe).length} sub-costs
              </span>
            )}
            {src.range && (
              <span>
                Range: {src.money.currency === 'PKR' ? '₨ ' : '$'}
                {src.range.low.toLocaleString()} – {src.range.high.toLocaleString()}
              </span>
            )}
            {maybeExtraPkr > 0 && (
              <span className="num">
                + maybe <Amount pkr={maybeExtraPkr} tone="muted" />
              </span>
            )}
          </div>

          {/* Variants switcher (§6.2) */}
          {variantTotals.length > 0 && (
            <div className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-full bg-[var(--surface-2)] p-0.5 border border-[var(--border)]">
              {variantTotals.map((vt) => {
                const active =
                  (cost.activeVariantId ?? variantTotals[0].id) === vt.id;
                const isLowest = lowestVariantId === vt.id;
                return (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() =>
                      state.updateCost(cost.id, { activeVariantId: vt.id })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <span>{vt.name}</span>
                    <Amount pkr={vt.pkr} compact tone={active ? 'default' : 'muted'} />
                    {isLowest && (
                      <span className="text-[10px] text-[var(--positive)] font-semibold">
                        lowest
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Amount + Include switch + Detail button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            onClick={() => onOpenDetail('details')}
            className={`text-right cursor-pointer ${
              !cost.included ? 'line-through' : ''
            }`}
          >
            <div className="text-sm font-semibold num">
              <Amount
                pkr={marketPkr}
                usd={nativeUsd ?? undefined}
                prefix={cost.maybe ? '+' : ''}
                tone={cost.maybe ? 'muted' : 'default'}
              />
            </div>
            {Math.round(afterTaxPkr) !== Math.round(marketPkr) ? (
              <div className="text-[11px] text-[var(--text-muted)] num">
                ×{settings.rates.effective}:{' '}
                <Amount
                  pkr={afterTaxPkr}
                  displayCurrency="PKR"
                  tone="muted"
                />
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] num">
                <Amount
                  pkr={marketPkr}
                  usd={nativeUsd ?? undefined}
                  displayCurrency={
                    settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                  }
                  tone="muted"
                />
              </div>
            )}
          </div>

          <Switch
            checked={cost.included}
            onChange={(included) => state.updateCost(cost.id, { included })}
          />

          <button
            type="button"
            onClick={() => onOpenDetail('details')}
            aria-label="Open cost details"
            className="p-1.5 rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paid progress bar if any paid */}
      {paidPkr > 0 && (
        <div className="mt-2 ml-7">
          <Progress value={paidPct} tone="positive" />
        </div>
      )}

      {/* Expanded sub-costs list (§6.2) */}
      {expanded && src.subCosts.length > 0 && (
        <div className="mt-3 ml-7 pl-4 border-l-2 border-[var(--border)] space-y-2">
          {src.subCosts.map((sc) => {
            const scPkr = subCostTotalPkr(cost, sc, settings);
            const sharePct =
              totalPkr > 0 && sc.included && !sc.maybe
                ? Math.min(100, (scPkr / totalPkr) * 100)
                : 0;
            return (
              <div
                key={sc.id}
                className={`flex items-center gap-3 text-sm ${
                  !sc.included ? 'opacity-50' : ''
                }`}
              >
                <Switch
                  checked={sc.included}
                  onChange={(included) => {
                    if (cost.variants && cost.variants.length > 0) {
                      const activeId =
                        cost.activeVariantId ?? cost.variants[0].id;
                      state.updateCost(cost.id, {
                        variants: cost.variants.map((v) =>
                          v.id === activeId
                            ? {
                                ...v,
                                subCosts: v.subCosts.map((item) =>
                                  item.id === sc.id ? { ...item, included } : item
                                ),
                              }
                            : v
                        ),
                      });
                    } else {
                      state.updateSubCost(cost.id, sc.id, { included });
                    }
                  }}
                />
                <span className={`flex-1 ${!sc.included ? 'line-through' : ''}`}>
                  {sc.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextMaybe = !sc.maybe;
                    if (cost.variants && cost.variants.length > 0) {
                      const activeId =
                        cost.activeVariantId ?? cost.variants[0].id;
                      state.updateCost(cost.id, {
                        variants: cost.variants.map((v) =>
                          v.id === activeId
                            ? {
                                ...v,
                                subCosts: v.subCosts.map((item) =>
                                  item.id === sc.id
                                    ? { ...item, maybe: nextMaybe }
                                    : item
                                ),
                              }
                            : v
                        ),
                      });
                    } else {
                      state.updateSubCost(cost.id, sc.id, { maybe: nextMaybe });
                    }
                  }}
                  className={`text-[11px] px-1.5 py-0.5 rounded-full border border-dashed cursor-pointer ${
                    sc.maybe
                      ? 'border-[#8B5CF6] text-[#8B5CF6]'
                      : 'border-[var(--border)] text-[var(--text-muted)] opacity-60'
                  }`}
                >
                  ? {sc.maybe ? 'Maybe' : 'Confirmed'}
                </button>
                <div className="w-20 hidden sm:block">
                  {sc.included && !sc.maybe && <Progress value={sharePct} />}
                </div>
                <div className="w-28 text-right num text-xs font-medium">
                  <Amount
                    pkr={scPkr}
                    prefix={sc.maybe ? '+' : ''}
                    tone={sc.maybe ? 'muted' : 'default'}
                  />
                </div>
              </div>
            );
          })}

          {addingSub ? (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="Sub-cost name"
                className="rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1 text-xs outline-none"
              />
              <MoneyInput value={subMoney} onChange={setSubMoney} />
              <Button size="sm" onClick={handleAddInlineSub}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddingSub(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSub(true)}
              className="text-xs text-[var(--accent)] font-medium hover:underline cursor-pointer"
            >
              + Add sub-cost
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CostsPage() {
  const state = useStore();
  const { costs, settings, transactions, accounts } = state;

  const [view, setView] = useState<CostViewMode>('phase');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const c of costs) {
      if (c.subCosts.length > 0) map[c.id] = true;
    }
    return map;
  });

  // Detail Sheet
  const [detailCostId, setDetailCostId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<CostSheetTab>('details');

  // Add Cost Sheet
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMoney, setNewMoney] = useState<{ amount: number; currency: Currency }>({
    amount: 0,
    currency: 'USD',
  });
  const [newKind, setNewKind] = useState<CostKind>('fixed');
  const [newPriority, setNewPriority] = useState<Priority>('must');
  const [newPhaseId, setNewPhaseId] = useState(settings.phases[0]?.id ?? 'general');
  const [newCategoryId, setNewCategoryId] = useState(
    settings.categories[0]?.id ?? 'misc'
  );
  const [newMaybe, setNewMaybe] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filteredCosts = useMemo(() => {
    return costs
      .filter((c) => {
        if (!showArchived && c.archived) return false;
        if (
          search.trim() &&
          !c.name.toLowerCase().includes(search.trim().toLowerCase())
        ) {
          return false;
        }
        if (kindFilter !== 'all' && c.kind !== kindFilter) return false;
        if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
        if (statusFilter !== 'all') {
          const st = costStatus(c, transactions, accounts, settings);
          if (st !== statusFilter) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [
    costs,
    showArchived,
    search,
    kindFilter,
    priorityFilter,
    statusFilter,
    transactions,
    accounts,
    settings,
  ]);

  const filteredConfirmedMarketPkr = useMemo(
    () =>
      filteredCosts
        .filter((c) => c.included && !c.maybe && !isCostExpired(c))
        .reduce((sum, c) => sum + costMarketPkr(c, settings), 0),
    [filteredCosts, settings]
  );

  const filteredConfirmedEffectivePkr = useMemo(
    () =>
      filteredCosts
        .filter((c) => c.included && !c.maybe && !isCostExpired(c))
        .reduce((sum, c) => sum + costEffectivePkr(c, settings), 0),
    [filteredCosts, settings]
  );

  const filteredMaybeTotalPkr = useMemo(
    () =>
      filteredCosts
        .filter((c) => c.included && !isCostExpired(c))
        .reduce(
          (sum, c) =>
            sum +
            (c.maybe ? costMarketPkr(c, settings) : 0) +
            costMaybeExtra(c, settings, 'market'),
          0
        ),
    [filteredCosts, settings]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filteredCosts.findIndex((c) => c.id === active.id);
    const newIdx = filteredCosts.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextIds = arrayMove(filteredCosts, oldIdx, newIdx).map((c) => c.id);
    state.reorderCosts(nextIds);
  };

  const handleCreateCost = () => {
    if (!newName.trim()) return;
    const created = state.addCost({
      name: newName.trim(),
      money: newMoney,
      kind: newKind,
      priority: newPriority,
      phaseId: newPhaseId,
      categoryId: newCategoryId,
      maybe: newMaybe,
    });
    setNewName('');
    setNewMoney({ amount: 0, currency: 'USD' });
    setNewMaybe(false);
    setAddOpen(false);
    setDetailCostId(created.id);
  };

  const handleExportCsv = () => {
    const csv = buildCostsCsv(filteredCosts, settings, transactions, accounts);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadTextFile(`rubenyaro-costs-${dateStr}.csv`, csv);
  };

  const detailCost = costs.find((c) => c.id === detailCostId) ?? null;

  // Timeline occurrences grouped by YYYY-MM
  const timelineGroups = useMemo(() => {
    const items: {
      monthKey: string;
      monthLabel: string;
      date: string;
      cost: Cost;
      amountPkr: number;
      occurrenceLabel?: string;
    }[] = [];

    for (const c of filteredCosts) {
      if (c.recurrence) {
        const dates = generateRecurrenceDates(c.recurrence);
        const perOccPkr = costTotal(c, settings) / (c.recurrence.occurrences || 1);
        dates.forEach((d, idx) => {
          items.push({
            monthKey: d.slice(0, 7),
            monthLabel: formatMonthYear(d),
            date: d,
            cost: c,
            amountPkr: perOccPkr,
            occurrenceLabel: `${idx + 1}/${dates.length}`,
          });
        });
      } else {
        const d = c.dueDate ?? c.temporary?.start ?? '9999-99-99';
        items.push({
          monthKey: d === '9999-99-99' ? '9999-99' : d.slice(0, 7),
          monthLabel: d === '9999-99-99' ? 'Unscheduled' : formatMonthYear(d),
          date: d,
          cost: c,
          amountPkr: costTotal(c, settings),
        });
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date));
    const grouped = new Map<string, { label: string; rows: typeof items }>();
    for (const it of items) {
      const existing = grouped.get(it.monthKey);
      if (existing) existing.rows.push(it);
      else grouped.set(it.monthKey, { label: it.monthLabel, rows: [it] });
    }
    return Array.from(grouped.entries());
  }, [filteredCosts, settings]);

  return (
    <div className="space-y-5">
      {/* Header (§6.2) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-micro">USMLE Journey Budget</p>
          <div className="flex flex-wrap items-baseline gap-3 mt-1">
            <h1 className="text-[24px] leading-[32px] font-semibold">Costs</h1>
            <span className="text-lg font-semibold num">
              <Amount
                pkr={filteredConfirmedMarketPkr}
                afterTaxPkr={filteredConfirmedEffectivePkr}
              />
            </span>
            {filteredMaybeTotalPkr > 0 && (
              <span className="text-xs text-[var(--text-muted)] num">
                + maybes <Amount pkr={filteredMaybeTotalPkr} tone="muted" />
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add cost
          </Button>
        </div>
      </div>

      {/* Toolbar (§6.2) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 w-full sm:w-64">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search costs…"
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
          />
        </div>

        <Segmented
          ariaLabel="Costs view switch"
          options={[
            { value: 'phase', label: 'By phase' },
            { value: 'category', label: 'By category' },
            { value: 'timeline', label: 'Timeline' },
            { value: 'table', label: 'Table' },
          ]}
          value={view}
          onChange={setView}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'planned', label: 'Planned' },
              { value: 'due_soon', label: 'Due soon' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
          <Select
            aria-label="Filter by kind"
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { value: 'all', label: 'All kinds' },
              { value: 'fixed', label: 'Fixed' },
              { value: 'estimate', label: 'Estimate' },
            ]}
          />
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: 'all', label: 'All priorities' },
              { value: 'must', label: 'Must' },
              { value: 'should', label: 'Should' },
              { value: 'nice', label: 'Nice' },
            ]}
          />
          {costs.some((c) => c.archived) && (
            <Switch
              checked={showArchived}
              onChange={setShowArchived}
              label="Archived"
            />
          )}
        </div>
      </div>

      {filteredCosts.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          message="No costs match the current filter."
          actionLabel="+ Add cost"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <>
          {/* VIEW 1 & 2: BY PHASE OR BY CATEGORY */}
          {(view === 'phase' || view === 'category') && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredCosts.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {(view === 'phase' ? settings.phases : settings.categories).map(
                    (group) => {
                      const groupCosts = filteredCosts.filter((c) =>
                        view === 'phase'
                          ? c.phaseId === group.id
                          : c.categoryId === group.id
                      );
                      if (groupCosts.length === 0) return null;
                      const groupConfirmedPkr = groupCosts
                        .filter((c) => c.included && !c.maybe)
                        .reduce((s, c) => s + costTotal(c, settings), 0);
                      const groupMaybePkr = groupCosts
                        .filter((c) => c.included)
                        .reduce(
                          (s, c) =>
                            s +
                            (c.maybe ? costTotal(c, settings) : 0) +
                            costMaybeExtra(c, settings),
                          0
                        );

                      return (
                        <Card
                          key={group.id}
                          noPadding
                          title={
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: group.color }}
                              />
                              <span>{group.name}</span>
                              <span className="text-xs font-normal text-[var(--text-muted)]">
                                ({groupCosts.length})
                              </span>
                            </div>
                          }
                          action={
                            <div className="text-right text-sm font-semibold num">
                              <Amount pkr={groupConfirmedPkr} />
                              {groupMaybePkr > 0 && (
                                <span className="text-xs font-normal text-[var(--text-muted)] ml-1.5">
                                  + maybe <Amount pkr={groupMaybePkr} compact tone="muted" />
                                </span>
                              )}
                            </div>
                          }
                        >
                          <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                            {groupCosts.map((cost) => (
                              <SortableCostRow
                                key={cost.id}
                                cost={cost}
                                expanded={Boolean(expandedIds[cost.id])}
                                onToggleExpand={() =>
                                  setExpandedIds((prev) => ({
                                    ...prev,
                                    [cost.id]: !prev[cost.id],
                                  }))
                                }
                                onOpenDetail={(tab = 'details') => {
                                  setDetailTab(tab);
                                  setDetailCostId(cost.id);
                                }}
                              />
                            ))}
                          </div>
                        </Card>
                      );
                    }
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* VIEW 3: TIMELINE (§6.2) */}
          {view === 'timeline' && (
            <div className="space-y-5">
              {timelineGroups.map(([monthKey, group]) => {
                const monthTotal = group.rows
                  .filter((r) => r.cost.included && !r.cost.maybe)
                  .reduce((s, r) => s + r.amountPkr, 0);
                return (
                  <Card
                    key={monthKey}
                    title={group.label}
                    action={
                      <span className="text-sm font-semibold num">
                        <Amount pkr={monthTotal} showSecondary />
                      </span>
                    }
                  >
                    <div className="relative pl-5 border-l-2 border-[var(--border)] space-y-3">
                      {group.rows.map((row, idx) => (
                        <div
                          key={`${row.cost.id}-${idx}`}
                          onClick={() => {
                            setDetailTab('details');
                            setDetailCostId(row.cost.id);
                          }}
                          className="relative flex items-center justify-between gap-3 p-3 rounded-[12px] bg-[var(--surface-2)] hover:border-[var(--accent)] border border-transparent cursor-pointer"
                        >
                          <span className="absolute -left-[25px] w-2.5 h-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--surface)]" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {row.cost.name}
                              </span>
                              {row.occurrenceLabel && (
                                <Chip>Occurrence {row.occurrenceLabel}</Chip>
                              )}
                              {row.cost.temporary && (
                                <Chip>
                                  Window: {row.cost.temporary.start} →{' '}
                                  {row.cost.temporary.end}
                                </Chip>
                              )}
                              {row.cost.maybe && <Chip>? Maybe</Chip>}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] num mt-0.5">
                              {row.date === '9999-99-99'
                                ? 'No due date set'
                                : formatShortDate(row.date)}
                            </p>
                          </div>
                          <div className="text-right font-semibold text-sm num">
                            <Amount
                              pkr={row.amountPkr}
                              prefix={row.cost.maybe ? '+' : ''}
                              tone={row.cost.maybe ? 'muted' : 'default'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* VIEW 4: TABLE (§6.2) */}
          {view === 'table' && (
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)] bg-[var(--surface-2)]">
                      <th className="py-2.5 px-4 font-medium">Name</th>
                      <th className="py-2.5 px-3 font-medium">Phase</th>
                      <th className="py-2.5 px-3 font-medium">Category</th>
                      <th className="py-2.5 px-3 font-medium">Kind</th>
                      <th className="py-2.5 px-3 font-medium text-right">Amount</th>
                      <th className="py-2.5 px-3 font-medium text-right">Paid</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredCosts.map((c) => {
                      const totalPkr = costTotal(c, settings);
                      const paidPkr = costPaid(c, transactions, accounts, settings);
                      const st = costStatus(c, transactions, accounts, settings);
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-[var(--surface-2)]/60 ${
                            !c.included ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) =>
                                state.updateCost(c.id, { name: e.target.value })
                              }
                              className="bg-transparent font-medium outline-none w-full"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={c.phaseId}
                              onChange={(e) =>
                                state.updateCost(c.id, { phaseId: e.target.value })
                              }
                              className="bg-transparent text-xs outline-none"
                            >
                              {settings.phases.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={c.categoryId}
                              onChange={(e) =>
                                state.updateCost(c.id, {
                                  categoryId: e.target.value,
                                })
                              }
                              className="bg-transparent text-xs outline-none"
                            >
                              {settings.categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <Chip
                              variant={c.kind === 'estimate' ? 'estimate' : 'default'}
                            >
                              {c.kind}
                            </Chip>
                          </td>
                          <td
                            onClick={() => {
                              setDetailTab('details');
                              setDetailCostId(c.id);
                            }}
                            className="py-2.5 px-3 text-right num font-medium cursor-pointer"
                          >
                            <Amount
                              pkr={totalPkr}
                              showSecondary
                              prefix={c.maybe ? '+' : ''}
                              tone={c.maybe ? 'muted' : 'default'}
                            />
                          </td>
                          <td
                            onClick={() => {
                              setDetailTab('payments');
                              setDetailCostId(c.id);
                            }}
                            className="py-2.5 px-3 text-right num cursor-pointer"
                          >
                            <Amount
                              pkr={paidPkr}
                              tone={paidPkr > 0 ? 'positive' : 'muted'}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <Chip
                              variant={
                                st === 'paid'
                                  ? 'positive'
                                  : st === 'overdue'
                                    ? 'negative'
                                    : st === 'due_soon' || st === 'partial'
                                      ? 'warning'
                                      : 'default'
                              }
                            >
                              {st.replace('_', ' ')}
                            </Chip>
                          </td>
                          <td className="py-2.5 px-4 text-xs num">
                            <input
                              type="date"
                              value={c.dueDate ?? ''}
                              onChange={(e) =>
                                state.updateCost(c.id, {
                                  dueDate: e.target.value || undefined,
                                })
                              }
                              className="bg-transparent outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Add Cost Sheet */}
      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add cost"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCost}>Save cost</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Cost name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Step 1 Exam Fee, UWorld Qbank"
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          <MoneyInput label="Amount" value={newMoney} onChange={setNewMoney} />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Phase"
              value={newPhaseId}
              onChange={setNewPhaseId}
              options={settings.phases.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
            <Select
              label="Category"
              value={newCategoryId}
              onChange={setNewCategoryId}
              options={settings.categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>

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
                value={newKind}
                onChange={(k) => setNewKind(k as CostKind)}
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
                value={newPriority}
                onChange={(p) => setNewPriority(p as Priority)}
              />
            </div>
          </div>

          <Switch
            checked={newMaybe}
            onChange={setNewMaybe}
            label="Maybe (uncertain cost)"
          />
        </div>
      </Sheet>

      <CostDetailSheet
        cost={detailCost}
        open={Boolean(detailCost)}
        initialTab={detailTab}
        onClose={() => setDetailCostId(null)}
      />
    </div>
  );
}
