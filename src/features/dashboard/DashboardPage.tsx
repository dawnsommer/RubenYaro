import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Plus, ArrowRight, Calendar } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  accountBalance,
  accountBalancePkr,
  costPaid,
  costStatus,
  costTotal,
  getActivePlanCosts,
  selectCoveragePercent,
  selectGapPkr,
  selectMaybeTotalPkr,
  selectPlanRangePkr,
  selectPlanTotalPkr,
  selectPlanWithMaybesPkr,
  selectRemainingPkr,
  selectSpendingPowerUsd,
  selectTotalFundsPkr,
  selectTotalPaidPkr,
} from '../../store/selectors';
import { daysUntil, formatShortDate } from '../../lib/dates';
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

  const totalFundsPkr = selectTotalFundsPkr(state);
  const confirmedPlanPkr = selectPlanTotalPkr(state);
  const maybeTotalPkr = selectMaybeTotalPkr(state);
  const planWithMaybesPkr = selectPlanWithMaybesPkr(state);

  const activePlanPkr = includeMaybes ? planWithMaybesPkr : confirmedPlanPkr;
  const totalPaidPkr = selectTotalPaidPkr(state, includeMaybes);
  const remainingPkr = selectRemainingPkr(state, includeMaybes);
  const gapPkr = selectGapPkr(state, includeMaybes);
  const gapWithMaybesPkr = selectGapPkr(state, true);
  const coveragePct = selectCoveragePercent(state, includeMaybes);
  const range = selectPlanRangePkr(state, includeMaybes);
  const spendingPower = selectSpendingPowerUsd(state);

  // Stacked hero bar ratios against activePlanPkr
  const paidBarPct =
    activePlanPkr > 0 ? Math.min(100, (totalPaidPkr / activePlanPkr) * 100) : 0;
  const fundedRemBarPct =
    activePlanPkr > 0
      ? Math.min(100 - paidBarPct, (totalFundsPkr / activePlanPkr) * 100)
      : 0;
  const unfundedBarPct = Math.max(0, 100 - paidBarPct - fundedRemBarPct);

  // Upcoming 5 unpaid costs by due date (or order if no due date)
  const upcomingCosts = useMemo(() => {
    const active = getActivePlanCosts(costs).filter(
      (c) =>
        (includeMaybes || !c.maybe) &&
        costStatus(c, transactions, accounts, settings) !== 'paid'
    );
    return active
      .slice()
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.order - b.order;
      })
      .slice(0, 5);
  }, [costs, includeMaybes, transactions, accounts, settings]);

  // Cost by phase
  const phaseStats = useMemo(() => {
    const active = getActivePlanCosts(costs).filter(
      (c) => includeMaybes || !c.maybe
    );
    return settings.phases
      .map((p) => {
        const pCosts = active.filter((c) => c.phaseId === p.id);
        const total = pCosts.reduce((s, c) => s + costTotal(c, settings), 0);
        const paid = pCosts.reduce(
          (s, c) => s + costPaid(c, transactions, accounts, settings),
          0
        );
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          totalPkr: total,
          paidPkr: paid,
          remainingPkr: Math.max(0, total - paid),
        };
      })
      .filter((p) => p.totalPkr > 0);
  }, [costs, includeMaybes, settings, transactions, accounts]);

  // Cost by category donut
  const categoryStats = useMemo(() => {
    const active = getActivePlanCosts(costs).filter(
      (c) => includeMaybes || !c.maybe
    );
    return settings.categories
      .map((cat) => {
        const catCosts = active.filter((c) => c.categoryId === cat.id);
        const total = catCosts.reduce((s, c) => s + costTotal(c, settings), 0);
        return {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          value: Math.round(total),
        };
      })
      .filter((c) => c.value > 0);
  }, [costs, includeMaybes, settings]);

  // Tasks snapshot
  const doneTasksCount = tasks.filter((t) => t.status === 'done').length;
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const nextThreeTasks = pendingTasks.slice(0, 3);
  const taskPct = tasks.length > 0 ? (doneTasksCount / tasks.length) * 100 : 0;

  const payingCost = costs.find((c) => c.id === payingCostId) ?? null;
  const isEmptyOnboarding = accounts.length === 0 && costs.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-micro">Overview</p>
          <h1 className="text-[24px] leading-[32px] font-semibold mt-1">Dashboard</h1>
        </div>
        <Button onClick={() => navigate('/costs')}>
          <Plus className="w-4 h-4" />
          Add cost
        </Button>
      </div>

      {/* Onboarding card when completely empty or no accounts yet (§8) */}
      {(isEmptyOnboarding || accounts.length === 0) && (
        <Card
          title="Get started in 3 quick steps"
          subtitle="Set up your rates, accounts, and USMLE starter budget."
          muted
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3.5 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[var(--accent)]">
                  ① Set exchange rates
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Card rate defaults to ₨{settings.rates.effective}/USD. Click any chip in
                  the top bar to adjust.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/settings')}
              >
                Review rates
              </Button>
            </div>

            <div className="p-3.5 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[var(--accent)]">
                  ② Add your accounts
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Add your PKR bank/savings or import your private data JSON in Settings.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => navigate('/accounts')}
              >
                + Add account
              </Button>
            </div>

            <div className="p-3.5 rounded-[12px] bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-[var(--accent)]">
                  ③ Starter USMLE costs
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {costs.length > 0
                    ? `${costs.length} starter costs loaded.`
                    : 'Load USMLE journey fees & checklist.'}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => state.loadStarterData()}
              >
                Reload starter data
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 12-column responsive grid (§6.1) */}
      <div className="grid grid-cols-12 gap-4">
        {/* 1. Hero "Funding status" card (span 8) */}
        <Card className="col-span-12 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-micro">Funding status</p>
            <Switch
              checked={includeMaybes}
              onChange={setIncludeMaybes}
              label="Include maybes"
            />
          </div>

          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <span className="text-[40px] leading-[44px] font-semibold num">
              <Amount
                pkr={Math.abs(gapPkr)}
                tone={gapPkr >= 0 ? 'positive' : 'negative'}
              />
            </span>
            <span
              className={`text-sm font-medium ${
                gapPkr >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
              }`}
            >
              {gapPkr >= 0 ? 'surplus' : 'short'}
            </span>
            <span className="text-sm text-[var(--text-muted)] num">
              ≈{' '}
              <Amount
                pkr={Math.abs(gapPkr)}
                displayCurrency={
                  settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                }
                tone="muted"
              />
            </span>
          </div>

          {/* Horizontal stacked bar: Paid | Funded remaining | Unfunded */}
          <div
            className="mt-5 h-3 rounded-full bg-[var(--surface-2)] overflow-hidden flex"
            role="img"
            aria-label={`Funding bar: ${Math.round(paidBarPct)}% paid, ${Math.round(
              fundedRemBarPct
            )}% funded, ${Math.round(unfundedBarPct)}% unfunded`}
          >
            {paidBarPct > 0 && (
              <div
                style={{
                  width: `${paidBarPct}%`,
                  backgroundColor: 'var(--positive)',
                }}
              />
            )}
            {fundedRemBarPct > 0 && (
              <div
                style={{
                  width: `${fundedRemBarPct}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            )}
            {unfundedBarPct > 0 && (
              <div
                style={{
                  width: `${unfundedBarPct}%`,
                  background:
                    'repeating-linear-gradient(45deg, var(--negative) 0 4px, transparent 4px 8px)',
                  opacity: 0.65,
                }}
              />
            )}
          </div>

          {/* Sub-line */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-muted)] num">
            <span>
              <b className="text-[var(--positive)]">●</b> Paid{' '}
              <Amount pkr={totalPaidPkr} compact tone="muted" />
            </span>
            <span>
              <b className="text-[var(--accent)]">●</b> Funds{' '}
              <Amount pkr={totalFundsPkr} compact tone="muted" />
            </span>
            <span>
              <b className="text-[var(--negative)]">●</b> Remaining{' '}
              <Amount pkr={remainingPkr} compact tone="muted" />
            </span>
            <span>
              Plan <Amount pkr={activePlanPkr} compact tone="muted" />
              {range.hasRange && (
                <span>
                  {' '}
                  (range <Amount pkr={range.lowPkr} compact tone="muted" />–
                  <Amount pkr={range.highPkr} compact tone="muted" />)
                </span>
              )}
            </span>
            <span>Coverage {Math.round(coveragePct)}%</span>
          </div>

          {/* Second line: With maybes comparison */}
          {maybeTotalPkr > 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)] num">
              <strong className="font-medium text-[var(--text)]">
                With maybes
              </strong>{' '}
              (+
              <Amount pkr={maybeTotalPkr} compact tone="muted" />
              ):{' '}
              <Amount
                pkr={Math.abs(gapWithMaybesPkr)}
                compact
                tone={gapWithMaybesPkr >= 0 ? 'positive' : 'negative'}
              />{' '}
              {gapWithMaybesPkr >= 0 ? 'surplus' : 'short'}
            </p>
          )}
        </Card>

        {/* 2. Spending power card (span 4) */}
        <Card className="col-span-12 lg:col-span-4 flex flex-col justify-between">
          <div>
            <p className="label-micro">Spending power</p>
            <div className="text-3xl font-semibold mt-2 num">
              <Amount
                pkr={spendingPower.spendingPowerUsd * settings.rates.effective}
                usd={spendingPower.spendingPowerUsd}
                displayCurrency="USD"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              PKR funds ÷ ₨{settings.rates.effective} card rate + real USD
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-between text-sm">
            <span className="text-[var(--text-muted)]">Real USD held</span>
            <span className="num font-medium">
              <Amount
                pkr={spendingPower.realUsdHeld * settings.rates.market}
                usd={spendingPower.realUsdHeld}
                displayCurrency="USD"
              />
            </span>
          </div>
        </Card>

        {/* 3. KPI row (4 small cards) */}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="label-micro">Total funds</p>
            <div className="text-xl font-semibold num mt-1">
              <Amount pkr={totalFundsPkr} />
            </div>
            <div className="text-xs text-[var(--text-muted)] num mt-0.5">
              <Amount
                pkr={totalFundsPkr}
                displayCurrency={
                  settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                }
                tone="muted"
              />
            </div>
          </Card>

          <Card>
            <p className="label-micro">Plan total</p>
            <div className="text-xl font-semibold num mt-1">
              <Amount pkr={activePlanPkr} />
            </div>
            <div className="text-xs text-[var(--text-muted)] num mt-0.5">
              <Amount
                pkr={activePlanPkr}
                displayCurrency={
                  settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                }
                tone="muted"
              />
            </div>
          </Card>

          <Card>
            <p className="label-micro">Paid</p>
            <div className="text-xl font-semibold num mt-1">
              <Amount pkr={totalPaidPkr} tone="positive" />
            </div>
            <div className="text-xs text-[var(--text-muted)] num mt-0.5">
              <Amount
                pkr={totalPaidPkr}
                displayCurrency={
                  settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                }
                tone="muted"
              />
            </div>
          </Card>

          <Card>
            <p className="label-micro">Remaining</p>
            <div className="text-xl font-semibold num mt-1">
              <Amount pkr={remainingPkr} />
            </div>
            <div className="text-xs text-[var(--text-muted)] num mt-0.5">
              <Amount
                pkr={remainingPkr}
                displayCurrency={
                  settings.displayCurrency === 'PKR' ? 'USD' : 'PKR'
                }
                tone="muted"
              />
            </div>
          </Card>
        </div>

        {/* 4. Upcoming payments (span 6) */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="Upcoming payments"
          action={
            <button
              type="button"
              onClick={() => navigate('/costs')}
              className="text-xs text-[var(--accent)] font-medium hover:underline cursor-pointer"
            >
              View all
            </button>
          }
        >
          {upcomingCosts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4">
              All planned costs are paid!
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {upcomingCosts.map((c) => {
                const st = costStatus(c, transactions, accounts, settings);
                const cTotal = costTotal(c, settings);
                return (
                  <div
                    key={c.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{c.name}</span>
                        {st !== 'planned' && (
                          <Chip
                            variant={st === 'overdue' ? 'negative' : 'warning'}
                          >
                            {st.replace('_', ' ')}
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {c.dueDate
                          ? `Due ${formatShortDate(c.dueDate)}`
                          : 'No due date'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-semibold num text-sm">
                        <Amount pkr={cTotal} compact />
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPayingCostId(c.id)}
                      >
                        Mark paid
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 5. Cost by phase (span 6) */}
        <Card className="col-span-12 lg:col-span-6" title="Cost by phase">
          <div className="space-y-3">
            {phaseStats.map((p) => {
              const maxPhase = Math.max(...phaseStats.map((x) => x.totalPkr), 1);
              const barPct = (p.totalPkr / maxPhase) * 100;
              const paidPct = p.totalPkr > 0 ? (p.paidPkr / p.totalPkr) * 100 : 0;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="num font-semibold">
                      <Amount pkr={p.totalPkr} compact />
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full relative overflow-hidden"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: p.color,
                      }}
                    >
                      {paidPct > 0 && (
                        <div
                          className="h-full bg-[var(--positive)]"
                          style={{ width: `${paidPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 6. Cost by category donut (span 4) */}
        <Card className="col-span-12 lg:col-span-4" title="By category">
          {categoryStats.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No costs.</p>
          ) : (
            <div className="space-y-3">
              <div className="h-44 w-full" aria-label="Category breakdown chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {categoryStats.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) =>
                        `₨ ${Math.round(val).toLocaleString('en-US')}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {categoryStats.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-1 truncate"
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="num text-[var(--text-muted)]">
                      <Amount pkr={cat.value} compact tone="muted" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 7. Accounts strip (span 8) */}
        <div className="col-span-12 lg:col-span-8 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] leading-[26px] font-semibold">Accounts</h2>
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="text-xs text-[var(--accent)] font-medium hover:underline cursor-pointer"
            >
              Manage accounts →
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {accounts
              .filter((a) => !a.archived)
              .map((acc) => {
                const nativeBal = accountBalance(acc, transactions);
                const pkrBal = accountBalancePkr(acc, transactions, settings);
                const usdBal =
                  acc.currency === 'USD'
                    ? nativeBal
                    : nativeBal / settings.rates.effective;
                return (
                  <div
                    key={acc.id}
                    onClick={() => navigate('/accounts')}
                    className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4 min-w-[200px] cursor-pointer hover:border-[var(--accent)]"
                  >
                    <p className="text-xs text-[var(--text-muted)]">
                      {acc.name} · {acc.currency}
                    </p>
                    <div className="text-lg font-semibold num mt-1">
                      <Amount
                        pkr={pkrBal}
                        usd={usdBal}
                        displayCurrency={acc.currency}
                      />
                    </div>
                    {acc.reserved && acc.reserved > 0 ? (
                      <p className="text-xs text-[var(--warning)] num mt-0.5">
                        Reserved{' '}
                        <Amount
                          pkr={
                            acc.currency === 'PKR'
                              ? acc.reserved
                              : acc.reserved * settings.rates.market
                          }
                          displayCurrency={acc.currency}
                          compact
                          tone="warning"
                        />
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] num mt-0.5">
                        ≈{' '}
                        <Amount
                          pkr={pkrBal}
                          usd={usdBal}
                          displayCurrency={
                            acc.currency === 'PKR' ? 'USD' : 'PKR'
                          }
                          tone="muted"
                        />
                      </p>
                    )}
                  </div>
                );
              })}
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 min-w-[160px] grid place-items-center text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)] cursor-pointer"
            >
              + Account
            </button>
          </div>
        </div>

        {/* 8. Tasks snapshot (span 6) */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="Pending tasks"
          action={
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] num">
              <Progress value={taskPct} variant="ring" size={26} />
              <span>
                {doneTasksCount} / {tasks.length}
              </span>
            </div>
          }
        >
          <div className="space-y-2.5">
            {nextThreeTasks.map((t) => {
              const linkedCost = t.linkedCostId
                ? costs.find((c) => c.id === t.linkedCostId)
                : undefined;
              return (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border)] last:border-0"
                >
                  <Checkbox
                    checked={t.status === 'done'}
                    onChange={(done) =>
                      state.updateTask(t.id, {
                        status: done ? 'done' : 'todo',
                        completedAt: done ? new Date().toISOString() : undefined,
                      })
                    }
                    label={t.title}
                  />
                  {linkedCost && (
                    <Chip variant="accent">
                      <Amount
                        pkr={costTotal(linkedCost, settings)}
                        compact
                        tone="default"
                      />
                    </Chip>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] font-medium hover:underline cursor-pointer pt-1"
            >
              Open tasks ({pendingTasks.length} pending){' '}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>

        {/* 9. Countdowns (span 6) */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="Countdowns"
          action={
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-xs text-[var(--accent)] font-medium hover:underline cursor-pointer"
            >
              Edit dates
            </button>
          }
        >
          {settings.journey.examDates.length === 0 &&
          !settings.journey.targetDate ? (
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] py-2">
              <span className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                No key dates or exam dates configured yet.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/settings')}
              >
                Add key date
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {settings.journey.targetDate && (
                <Chip variant="accent" className="text-xs py-1 px-3">
                  Target · {daysUntil(settings.journey.targetDate)} days
                </Chip>
              )}
              {settings.journey.examDates.map((kd) => {
                const d = daysUntil(kd.date);
                return (
                  <Chip
                    key={kd.id}
                    variant={d < 0 ? 'negative' : d <= 30 ? 'warning' : 'accent'}
                    className="text-xs py-1 px-3"
                  >
                    {kd.label} · {d >= 0 ? `${d} days` : `${Math.abs(d)}d ago`}
                  </Chip>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <CostDetailSheet
        cost={payingCost}
        open={Boolean(payingCost)}
        initialTab="payments"
        onClose={() => setPayingCostId(null)}
      />
    </div>
  );
}
