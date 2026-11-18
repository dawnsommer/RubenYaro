import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pin,
  ArrowRight,
  Wallet,
  Receipt,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  accountBalance,
  accountBalancePkr,
  costEffectivePkr,
  costMarketPkr,
  costNativeUsd,
  costStatus,
  getActivePlanCosts,
  selectPlanTotalEffectivePkr,
  selectPlanTotalMarketPkr,
  selectTotalFundsPkr,
  selectTotalPaidPkr,
} from '../../store/selectors';
import { formatShortDate } from '../../lib/dates';
import {
  Amount,
  Button,
  Card,
  Checkbox,
  Chip,
  Progress,
  Switch,
} from '../../components/ui';
import { CostDetailSheet } from '../costs/CostDetailSheet';

export function DashboardPage() {
  const state = useStore();
  const navigate = useNavigate();
  const { settings, accounts, costs, tasks, transactions } = state;

  const [includeMaybes, setIncludeMaybes] = useState(false);
  const [payingCostId, setPayingCostId] = useState<string | null>(null);

  // Pinned upcoming tasks (shown right at the top of the front page)
  const pinnedTasks = useMemo(() => {
    const pinnedPending = tasks
      .filter((t) => t.status !== 'done' && t.pinned)
      .slice()
      .sort((a, b) => a.order - b.order);

    // If user hasn't pinned any pending task, fall back to top 3 pending tasks
    if (pinnedPending.length > 0) return pinnedPending;
    return tasks
      .filter((t) => t.status !== 'done')
      .slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 3);
  }, [tasks]);

  // Dual totals: actual market rate vs ×300 after-tax rate
  const totalFundsPkr = selectTotalFundsPkr(state);
  const totalPaidPkr = selectTotalPaidPkr(state, includeMaybes);
  const planMarketPkr = selectPlanTotalMarketPkr(state, includeMaybes);
  const planAfterTaxPkr = selectPlanTotalEffectivePkr(state, includeMaybes);

  const remMarketPkr = Math.max(0, planMarketPkr - totalPaidPkr);
  const remAfterTaxPkr = Math.max(0, planAfterTaxPkr - totalPaidPkr);

  const gapMarketPkr = totalFundsPkr - remMarketPkr;
  const gapAfterTaxPkr = totalFundsPkr - remAfterTaxPkr;

  const paidBarPct =
    planMarketPkr > 0 ? Math.min(100, (totalPaidPkr / planMarketPkr) * 100) : 0;
  const fundedBarPct =
    planMarketPkr > 0
      ? Math.min(100 - paidBarPct, (totalFundsPkr / planMarketPkr) * 100)
      : 0;

  // Main active costs for quick glance
  const topUnpaidCosts = useMemo(() => {
    return getActivePlanCosts(costs)
      .filter(
        (c) =>
          (includeMaybes || !c.maybe) &&
          costStatus(c, transactions, accounts, settings) !== 'paid'
      )
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [costs, includeMaybes, transactions, accounts, settings]);

  const payingCost = costs.find((c) => c.id === payingCostId) ?? null;

  return (
    <div className="space-y-4">
      {/* 1. TOP OF FRONT PAGE: Pinned Upcoming Tasks */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-[var(--accent)]" />
            <span>Pinned Upcoming Tasks</span>
          </div>
        }
        action={
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
          >
            All tasks <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        {pinnedTasks.length === 0 ? (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] py-2">
            <span>All tasks done! Pin any task in the Tasks tab to keep it here.</span>
            <Button size="sm" variant="secondary" onClick={() => navigate('/tasks')}>
              Open Tasks
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {pinnedTasks.map((t) => {
              const linkedCost = t.linkedCostId
                ? costs.find((c) => c.id === t.linkedCostId)
                : undefined;
              const progPct = t.progress
                ? (t.progress.current / Math.max(1, t.progress.total)) * 100
                : 0;
              return (
                <div
                  key={t.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5">
                      <Checkbox
                        checked={t.status === 'done'}
                        onChange={(done) =>
                          state.updateTask(t.id, {
                            status: done ? 'done' : 'todo',
                            completedAt: done ? new Date().toISOString() : undefined,
                          })
                        }
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{t.title}</span>
                        {t.dueDate && <Chip>{formatShortDate(t.dueDate)}</Chip>}
                      </div>
                      {t.progress && (
                        <div className="mt-1.5 flex items-center gap-2 max-w-xs">
                          <div className="flex-1">
                            <Progress value={progPct} />
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] num">
                            {t.progress.current}/{t.progress.total}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              state.updateTask(t.id, {
                                progress: {
                                  ...t.progress!,
                                  current: Math.min(
                                    t.progress!.total,
                                    t.progress!.current + 40
                                  ),
                                },
                              })
                            }
                            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
                          >
                            +40
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {linkedCost && (
                      <button
                        type="button"
                        onClick={() => setPayingCostId(linkedCost.id)}
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--accent-soft)] text-[var(--accent)] cursor-pointer"
                      >
                        <Amount
                          pkr={costMarketPkr(linkedCost, settings)}
                          afterTaxPkr={costEffectivePkr(linkedCost, settings)}
                          usd={costNativeUsd(linkedCost) ?? undefined}
                          compact
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => state.updateTask(t.id, { pinned: !t.pinned })}
                      aria-label={t.pinned ? 'Unpin task' : 'Pin task'}
                      title={t.pinned ? 'Unpin from top' : 'Pin to top'}
                      className={`p-1.5 rounded-[8px] cursor-pointer ${
                        t.pinned
                          ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 2. Simple Funding Summary Card (Market Rate + Smaller ×300 After-Tax) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label-micro">Funding Summary</p>
          <Switch
            checked={includeMaybes}
            onChange={setIncludeMaybes}
            label="Include maybes"
          />
        </div>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-3xl sm:text-4xl font-semibold num">
                <Amount
                  pkr={Math.abs(gapMarketPkr)}
                  tone={gapMarketPkr >= 0 ? 'positive' : 'negative'}
                />
              </span>
              <span
                className={`text-sm font-medium ${
                  gapMarketPkr >= 0
                    ? 'text-[var(--positive)]'
                    : 'text-[var(--negative)]'
                }`}
              >
                {gapMarketPkr >= 0 ? 'surplus (market)' : 'short (market)'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] num mt-1">
              After tax (×{settings.rates.effective}):{' '}
              <strong
                className={
                  gapAfterTaxPkr >= 0
                    ? 'text-[var(--positive)]'
                    : 'text-[var(--negative)]'
                }
              >
                <Amount
                  pkr={Math.abs(gapAfterTaxPkr)}
                  tone={gapAfterTaxPkr >= 0 ? 'positive' : 'negative'}
                />{' '}
                {gapAfterTaxPkr >= 0 ? 'surplus' : 'short'}
              </strong>
            </p>
          </div>

          {accounts.length === 0 && (
            <Button size="sm" onClick={() => navigate('/accounts')}>
              <Wallet className="w-3.5 h-3.5" />+ Add your savings / bank
            </Button>
          )}
        </div>

        {/* Clean progress bar */}
        <div className="mt-4 h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden flex">
          {paidBarPct > 0 && (
            <div
              style={{
                width: `${paidBarPct}%`,
                backgroundColor: 'var(--positive)',
              }}
            />
          )}
          {fundedBarPct > 0 && (
            <div
              style={{
                width: `${fundedBarPct}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          )}
        </div>

        {/* 4 compact KPI boxes: mobile 2x2, desktop 4 cols */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-[12px] bg-[var(--surface-2)]">
            <p className="label-micro">My Funds</p>
            <p className="text-base sm:text-lg font-semibold num mt-0.5">
              <Amount pkr={totalFundsPkr} compact />
            </p>
          </div>
          <div className="p-3 rounded-[12px] bg-[var(--surface-2)]">
            <p className="label-micro">Total Plan (Market)</p>
            <p className="text-base sm:text-lg font-semibold num mt-0.5">
              <Amount pkr={planMarketPkr} compact />
            </p>
            <p className="text-[11px] text-[var(--text-muted)] num">
              ×{settings.rates.effective}:{' '}
              <Amount pkr={planAfterTaxPkr} compact tone="muted" />
            </p>
          </div>
          <div className="p-3 rounded-[12px] bg-[var(--surface-2)]">
            <p className="label-micro">Paid</p>
            <p className="text-base sm:text-lg font-semibold num mt-0.5">
              <Amount pkr={totalPaidPkr} compact tone="positive" />
            </p>
          </div>
          <div className="p-3 rounded-[12px] bg-[var(--surface-2)]">
            <p className="label-micro">Remaining</p>
            <p className="text-base sm:text-lg font-semibold num mt-0.5">
              <Amount pkr={remMarketPkr} compact />
            </p>
            <p className="text-[11px] text-[var(--text-muted)] num">
              ×{settings.rates.effective}:{' '}
              <Amount pkr={remAfterTaxPkr} compact tone="muted" />
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Main Costs List (Market rate + smaller ×300 after-tax) */}
      <Card
        title="Journey Costs"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/costs')}>
              <Receipt className="w-3.5 h-3.5" />
              Manage costs
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-[var(--border)]">
          {topUnpaidCosts.map((c) => {
            const mktPkr = costMarketPkr(c, settings);
            const effPkr = costEffectivePkr(c, settings);
            const nativeUsd = costNativeUsd(c);
            return (
              <div
                key={c.id}
                onClick={() => setPayingCostId(c.id)}
                className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--surface-2)]/40 rounded-[8px] px-1"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{c.name}</span>
                    {c.maybe && <Chip>? Maybe</Chip>}
                    {c.subCosts.length > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">
                        ({c.subCosts.filter((s) => s.included && !s.maybe).length} items)
                      </span>
                    )}
                  </div>
                  {nativeUsd !== null && (
                    <p className="text-xs text-[var(--text-muted)] num">
                      ${nativeUsd.toLocaleString('en-US')} USD
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold num">
                    <Amount pkr={mktPkr} usd={nativeUsd ?? undefined} />
                  </div>
                  {Math.round(effPkr) !== Math.round(mktPkr) && (
                    <div className="text-[11px] text-[var(--text-muted)] num">
                      ×{settings.rates.effective}:{' '}
                      <Amount
                        pkr={effPkr}
                        displayCurrency="PKR"
                        tone="muted"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 4. Accounts Quick Strip */}
      <Card
        title="Accounts"
        action={
          <button
            type="button"
            onClick={() => navigate('/accounts')}
            className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
          >
            Manage →
          </button>
        }
      >
        {accounts.filter((a) => !a.archived).length === 0 ? (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>No accounts added yet (or import your private data in Settings).</span>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounts')}>
              <Plus className="w-3.5 h-3.5" />
              Add account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {accounts
              .filter((a) => !a.archived)
              .map((acc) => {
                const nativeBal = accountBalance(acc, transactions);
                const pkrBal = accountBalancePkr(acc, transactions, settings);
                return (
                  <div
                    key={acc.id}
                    onClick={() => navigate('/accounts')}
                    className="p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer hover:border-[var(--accent)]"
                  >
                    <p className="text-xs text-[var(--text-muted)]">
                      {acc.name} ({acc.currency})
                    </p>
                    <p className="text-lg font-semibold num mt-0.5">
                      <Amount
                        pkr={pkrBal}
                        usd={acc.currency === 'USD' ? nativeBal : undefined}
                        displayCurrency={acc.currency}
                      />
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <CostDetailSheet
        cost={payingCost}
        open={Boolean(payingCost)}
        initialTab="details"
        onClose={() => setPayingCostId(null)}
      />
    </div>
  );
}
