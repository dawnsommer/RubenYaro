import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, ChevronDown, Download, GripVertical, Plus, Receipt, Repeat, Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costEffectivePkr,
  costMarketPkr,
  costMaybeExtra,
  costNativeUsd,
  costPaid,
  costSource,
  costStatus,
  costNextDue,
  isCostExpired,
} from '../../store/selectors';
import { formatMonthYear, formatShortDate } from '../../lib/dates';
import { buildCostsCsv, downloadTextFile } from '../../lib/csv';
import { Cost, Money } from '../../types';
import { Amount, Button, Chip, EmptyState, MoneyInput, Segmented } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { CostEditor } from './CostEditor';
import { STATUS_LABEL, STATUS_VARIANT } from './costUi';

type GroupBy = 'phase' | 'category' | 'month';
type Filter = 'all' | 'unpaid' | 'paid' | 'maybe';

interface CostRowProps {
  cost: Cost;
  open: boolean;
  draggable: boolean;
  onToggle: () => void;
}

function CostRow({ cost, open, draggable, onToggle }: CostRowProps) {
  const { settings, transactions, accounts } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cost.id,
    disabled: !draggable || open,
  });
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  const src = costSource(cost);
  const marketPkr = costMarketPkr(cost, settings);
  const cardPkr = costEffectivePkr(cost, settings);
  const nativeUsd = costNativeUsd(cost);
  const paidPkr = costPaid(cost, transactions, accounts, settings);
  const status = costStatus(cost, transactions, accounts, settings);
  const expired = isCostExpired(cost);
  const category = settings.categories.find((c) => c.id === cost.categoryId);
  const paidPct = marketPkr > 0 ? Math.min(100, (paidPkr / marketPkr) * 100) : 0;
  const dimmed = !cost.included || expired || cost.archived;
  const nextDue = costNextDue(cost);

  const meta = [
    category?.name,
    nextDue ? `Due ${formatShortDate(nextDue)}` : null,
    src.subCosts.length ? `${src.subCosts.length} items` : null,
    cost.variants?.length ? `${cost.variants.length} options` : null,
  ].filter(Boolean);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef.current = el;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 bg-[var(--surface)] shadow-[var(--shadow-md)] rounded-[14px]' : ''} ${
        open ? 'bg-[var(--surface)]' : ''
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if ((e.target as HTMLElement).tagName === 'DIV') {
              e.preventDefault();
              onToggle();
            }
          }
        }}
        className={`group flex items-center gap-3 px-4 sm:px-5 py-3.5 cursor-pointer select-none transition-colors ${
          open ? '' : 'hover:bg-[var(--surface-2)]/60'
        } ${dimmed ? 'opacity-50' : ''}`}
      >
        {draggable && !open && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="hidden sm:grid absolute left-0.5 w-4 place-items-center text-[var(--text-faint)] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        <span
          className="w-2 h-8 rounded-full shrink-0"
          style={{ backgroundColor: category?.color ?? 'var(--accent)' }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`truncate text-[14px] font-medium ${!cost.included ? 'line-through' : ''}`}>
              {cost.name}
            </span>
            {cost.maybe && <Chip variant="maybe">Maybe</Chip>}
            {cost.kind === 'estimate' && <Chip variant="estimate">≈</Chip>}
            {cost.recurrence && (
              <Chip>
                <Repeat className="w-3 h-3" />×{cost.recurrence.occurrences}
              </Chip>
            )}
            {cost.verify && (
              <AlertCircle className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" aria-label="Verify price" />
            )}
            {status !== 'planned' && (
              <Chip variant={STATUS_VARIANT[status]} className="hidden sm:inline-flex">
                {STATUS_LABEL[status]}
              </Chip>
            )}
            {expired && <Chip variant="negative">Expired</Chip>}
          </div>
          {meta.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{meta.join(' · ')}</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-[14px] font-semibold num">
            <Amount
              pkr={marketPkr}
              usd={nativeUsd ?? undefined}
              prefix={cost.maybe ? '+' : ''}
              tone={cost.maybe ? 'muted' : 'default'}
            />
          </div>
          {Math.round(cardPkr) !== Math.round(marketPkr) && (
            <div className="text-[11px] text-[var(--text-faint)] num">
              card <Amount pkr={cardPkr} displayCurrency="PKR" compact tone="muted" />
            </div>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[var(--text-faint)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {paidPkr > 0 && !open && (
        <div className="absolute left-4 sm:left-5 right-4 sm:right-5 bottom-0 h-[2px] rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div className="h-full bg-[var(--positive)]" style={{ width: `${paidPct}%` }} />
        </div>
      )}

      {open && <CostEditor cost={cost} onClose={onToggle} />}
    </div>
  );
}

export function CostsPage() {
  const state = useStore();
  const { costs, settings, transactions, accounts } = state;
  const [searchParams, setSearchParams] = useSearchParams();

  const [groupBy, setGroupBy] = useState<GroupBy>('phase');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Quick add
  const [newName, setNewName] = useState('');
  const [newMoney, setNewMoney] = useState<Money>({ amount: 0, currency: 'USD' });
  const [newPhaseId, setNewPhaseId] = useState(settings.phases[0]?.id ?? '');

  // Deep link: #/costs?open=<id>
  useEffect(() => {
    const id = searchParams.get('open');
    if (id) {
      setOpenId(id);
      const c = costs.find((x) => x.id === id);
      if (c?.archived) setShowArchived(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return costs
      .filter((c) => {
        if (c.archived && !showArchived && c.id !== openId) return false;
        if (q && !c.name.toLowerCase().includes(q)) return false;
        if (filter === 'maybe' && !c.maybe) return false;
        if (filter === 'paid' || filter === 'unpaid') {
          const paid = costStatus(c, transactions, accounts, settings) === 'paid';
          if (filter === 'paid' ? !paid : paid) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [costs, showArchived, search, filter, transactions, accounts, settings, openId]);

  const totals = useMemo(() => {
    const active = costs.filter((c) => c.included && !c.archived && !isCostExpired(c));
    const confirmed = active.filter((c) => !c.maybe);
    const market = confirmed.reduce((s, c) => s + costMarketPkr(c, settings), 0);
    const card = confirmed.reduce((s, c) => s + costEffectivePkr(c, settings), 0);
    const paid = confirmed.reduce((s, c) => s + costPaid(c, transactions, accounts, settings), 0);
    const maybe = active.reduce(
      (s, c) => s + (c.maybe ? costMarketPkr(c, settings) : 0) + costMaybeExtra(c, settings, 'market'),
      0
    );
    return { market, card, paid, maybe, count: active.length };
  }, [costs, settings, transactions, accounts]);

  const groups = useMemo(() => {
    if (groupBy === 'month') {
      const map = new Map<string, { id: string; name: string; color?: string; costs: Cost[] }>();
      const sorted = visible
        .slice()
        .sort((a, b) =>
          (costNextDue(a) ?? a.recurrence?.startDate ?? '9999').localeCompare(
            costNextDue(b) ?? b.recurrence?.startDate ?? '9999'
          )
        );
      for (const c of sorted) {
        const d = costNextDue(c) ?? c.recurrence?.startDate ?? c.temporary?.start;
        const key = d ? d.slice(0, 7) : 'none';
        const name = d ? formatMonthYear(d) : 'No date yet';
        if (!map.has(key)) map.set(key, { id: key, name, costs: [] });
        map.get(key)!.costs.push(c);
      }
      return Array.from(map.values());
    }
    const source = groupBy === 'phase' ? settings.phases : settings.categories;
    const list: { id: string; name: string; color?: string; costs: Cost[] }[] = source.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      costs: visible.filter((c) => (groupBy === 'phase' ? c.phaseId : c.categoryId) === g.id),
    }));
    const known = new Set(source.map((g) => g.id));
    const orphans = visible.filter((c) => !known.has(groupBy === 'phase' ? c.phaseId : c.categoryId));
    if (orphans.length) list.push({ id: '__other', name: 'Other', color: undefined, costs: orphans });
    return list.filter((g) => g.costs.length > 0);
  }, [visible, groupBy, settings.phases, settings.categories]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = visible.findIndex((c) => c.id === active.id);
    const newIdx = visible.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    state.reorderCosts(arrayMove(visible, oldIdx, newIdx).map((c) => c.id));
  };

  const handleQuickAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const created = state.addCost({
      name,
      money: newMoney,
      kind: 'fixed',
      priority: 'must',
      phaseId: newPhaseId || settings.phases[0]?.id || 'general',
      categoryId: settings.categories[0]?.id ?? 'misc',
    });
    setNewName('');
    setNewMoney({ amount: 0, currency: newMoney.currency });
    setFilter('all');
    setSearch('');
    setOpenId(created.id);
  };

  const handleExportCsv = () => {
    const csv = buildCostsCsv(visible, settings, transactions, accounts);
    downloadTextFile(`rubenyaro-costs-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const paidPct = totals.market > 0 ? Math.min(100, (totals.paid / totals.market) * 100) : 0;
  const hasArchived = costs.some((c) => c.archived);

  return (
    <div>
      <PageHeader
        title="Costs"
        subtitle={`${totals.count} costs in your plan`}
        actions={
          <Button variant="ghost" size="sm" onClick={handleExportCsv} tooltip="Export CSV">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        }
      />

      {/* Summary */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="label-micro">Total plan</p>
            <p className="text-xl sm:text-2xl font-semibold num mt-1 tracking-[-0.02em]">
              <Amount pkr={totals.card} compact />
            </p>
            <p className="text-xs text-[var(--text-faint)] num mt-0.5">
              after tax · market <Amount pkr={totals.market} compact tone="muted" />
            </p>
          </div>
          <div>
            <p className="label-micro">Paid</p>
            <p className="text-xl sm:text-2xl font-semibold num mt-1 tracking-[-0.02em]">
              <Amount pkr={totals.paid} compact tone={totals.paid > 0 ? 'positive' : 'default'} />
            </p>
            <p className="text-xs text-[var(--text-faint)] num mt-0.5">{Math.round(paidPct)}% done</p>
          </div>
          <div>
            <p className="label-micro">Maybe</p>
            <p className="text-xl sm:text-2xl font-semibold num mt-1 tracking-[-0.02em] text-[var(--maybe)]">
              <Amount pkr={totals.maybe} compact prefix="+" tone="muted" className="!text-[var(--maybe)]" />
            </p>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">not in plan</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--positive)] transition-all" style={{ width: `${paidPct}%` }} />
        </div>
      </div>

      {/* Quick add */}
      <div className="card p-2 mb-5 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] pl-2">
          <Plus className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
            placeholder="Add a cost — e.g. Step 2 CK fee"
            className="flex-1 bg-transparent text-sm outline-none py-2 min-w-0"
          />
        </div>
        <MoneyInput compact value={newMoney} onChange={setNewMoney} onEnter={handleQuickAdd} className="flex-1 sm:flex-none sm:w-[170px]" />
        <select
          value={newPhaseId}
          onChange={(e) => setNewPhaseId(e.target.value)}
          aria-label="Phase for new cost"
          className="field !w-auto !py-1.5 text-xs"
        >
          {settings.phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={handleQuickAdd} disabled={!newName.trim()}>
          Add
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Segmented
          ariaLabel="Filter costs"
          options={[
            { value: 'all', label: 'All' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'paid', label: 'Paid' },
            { value: 'maybe', label: 'Maybe' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span className="hidden sm:inline">Group</span>
          <Segmented
            ariaLabel="Group costs by"
            options={[
              { value: 'phase', label: 'Phase' },
              { value: 'category', label: 'Category' },
              { value: 'month', label: 'Month' },
            ]}
            value={groupBy}
            onChange={setGroupBy}
          />
        </div>
        <div className="flex-1" />
        {hasArchived && (
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className={`text-xs font-medium px-3 h-8 rounded-full cursor-pointer ${
              showArchived ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        )}
        <div className="field !w-full sm:!w-56 flex items-center gap-2 !py-1.5 !rounded-full">
          <Search className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          message={costs.length === 0 ? 'No costs yet. Add your first one above.' : 'Nothing matches this filter.'}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {groups.map((g) => {
                const sum = g.costs
                  .filter((c) => c.included && !c.maybe && !c.archived)
                  .reduce((s, c) => s + costMarketPkr(c, settings), 0);
                return (
                  <section key={g.id}>
                    <div className="flex items-center justify-between gap-2 px-1 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {g.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />}
                        <h2 className="text-[13px] font-semibold truncate">{g.name}</h2>
                        <span className="text-xs text-[var(--text-faint)]">{g.costs.length}</span>
                      </div>
                      <span className="text-[13px] font-semibold num text-[var(--text-muted)]">
                        <Amount pkr={sum} tone="muted" />
                      </span>
                    </div>
                    <div className="card overflow-hidden divide-y divide-[var(--border)]">
                      {g.costs.map((c) => (
                        <CostRow
                          key={c.id}
                          cost={c}
                          open={openId === c.id}
                          draggable={groupBy !== 'month'}
                          onToggle={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
