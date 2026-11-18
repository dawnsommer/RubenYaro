import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Pin } from 'lucide-react';
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
import { daysUntil, formatShortDate } from '../../lib/dates';
import { Amount, Checkbox, Chip, Progress } from '../../components/ui';
import { STATUS_LABEL, STATUS_VARIANT } from '../costs/costUi';

function SectionCard({
  title,
  to,
  linkLabel = 'See all',
  children,
}: {
  title: string;
  to?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {to && (
          <Link
            to={to}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const state = useStore();
  const navigate = useNavigate();
  const { settings, accounts, costs, tasks, transactions } = state;
  const [includeMaybes, setIncludeMaybes] = useState(false);

  const fundsPkr = selectTotalFundsPkr(state);
  const paidPkr = selectTotalPaidPkr(state, includeMaybes);
  const planMarketPkr = selectPlanTotalMarketPkr(state, includeMaybes);
  const planCardPkr = selectPlanTotalEffectivePkr(state, includeMaybes);
  const leftMarketPkr = Math.max(0, planMarketPkr - paidPkr);
  const leftCardPkr = Math.max(0, planCardPkr - paidPkr);
  const gapMarket = fundsPkr - leftMarketPkr;
  const gapCard = fundsPkr - leftCardPkr;
  const ok = gapMarket >= 0;

  const paidPct = planMarketPkr > 0 ? Math.min(100, (paidPkr / planMarketPkr) * 100) : 0;
  const fundedPct =
    planMarketPkr > 0 ? Math.min(100 - paidPct, (fundsPkr / planMarketPkr) * 100) : 0;

  const upNext = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done').sort((a, b) => a.order - b.order);
    const pinned = open.filter((t) => t.pinned);
    return (pinned.length ? pinned : open).slice(0, 5);
  }, [tasks]);
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const unpaid = useMemo(
    () =>
      getActivePlanCosts(costs)
        .filter((c) => (includeMaybes || !c.maybe) && costStatus(c, transactions, accounts, settings) !== 'paid')
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.order - b.order;
        })
        .slice(0, 6),
    [costs, includeMaybes, transactions, accounts, settings]
  );

  const keyDates = settings.journey.examDates
    .map((d) => ({ ...d, days: daysUntil(d.date) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  const liveAccounts = accounts.filter((a) => !a.archived);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-[24px] p-6 sm:p-7 text-white shadow-[var(--shadow-md)]"
        style={{ background: 'linear-gradient(135deg, var(--hero-from), var(--hero-to))' }}
      >
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-white/75">
              {ok ? 'You’re covered with room to spare' : 'You still need'}
            </p>
            <button
              type="button"
              onClick={() => setIncludeMaybes((v) => !v)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                includeMaybes ? 'bg-white text-[var(--hero-from)]' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {includeMaybes ? 'With maybes' : 'Confirmed only'}
            </button>
          </div>

          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <span className="text-[40px] sm:text-[48px] leading-none font-semibold tracking-[-0.04em] num">
              <Amount pkr={Math.abs(gapMarket)} className="!text-white" />
            </span>
            <span className="text-sm font-medium text-white/80">{ok ? 'surplus' : 'short'}</span>
          </div>
          <p className="mt-2 text-xs text-white/70 num">
            At card rate ×{settings.rates.effective}:{' '}
            <Amount pkr={Math.abs(gapCard)} compact className="!text-white font-semibold" />{' '}
            {gapCard >= 0 ? 'surplus' : 'short'}
          </p>

          <div className="mt-5 h-2 rounded-full bg-white/20 overflow-hidden flex">
            <div className="bg-white" style={{ width: `${paidPct}%` }} />
            <div className="bg-white/50" style={{ width: `${fundedPct}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'My money', pkr: fundsPkr },
              { label: 'Total plan', pkr: planMarketPkr },
              { label: 'Paid', pkr: paidPkr },
              { label: 'Left to pay', pkr: leftMarketPkr },
            ].map((k) => (
              <div key={k.label}>
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/60">{k.label}</p>
                <p className="text-lg font-semibold num mt-0.5">
                  <Amount pkr={k.pkr} compact className="!text-white" />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key dates */}
      {keyDates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {keyDates.map((d) => (
            <div
              key={d.id}
              className="card shrink-0 flex items-center gap-3 px-4 py-3 !rounded-[16px]"
            >
              <CalendarClock className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <p className="text-xs font-medium">{d.label}</p>
                <p className="text-[11px] text-[var(--text-muted)] num">
                  {d.days === 0 ? 'Today' : `in ${d.days} days`} · {formatShortDate(d.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Up next */}
        <SectionCard title="Up next" to="/tasks" linkLabel={`${doneCount}/${tasks.length} done`}>
          {upNext.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">All tasks done 🎉</p>
          ) : (
            <ul className="space-y-1 -mx-2">
              {upNext.map((t) => {
                const pct = t.progress ? (t.progress.current / Math.max(1, t.progress.total)) * 100 : null;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-2 py-2 rounded-[12px] hover:bg-[var(--surface-2)]/60">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={false}
                        onChange={() =>
                          state.updateTask(t.id, { status: 'done', completedAt: new Date().toISOString() })
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.pinned && <Pin className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                        <span className="text-sm truncate">{t.title}</span>
                      </div>
                      {pct !== null && (
                        <div className="mt-1.5 flex items-center gap-2 max-w-[220px]">
                          <Progress value={pct} />
                          <span className="text-[11px] text-[var(--text-muted)] num shrink-0">
                            {t.progress!.current}/{t.progress!.total}
                          </span>
                        </div>
                      )}
                    </div>
                    {t.dueDate && (
                      <span className="text-[11px] text-[var(--text-muted)] num shrink-0 pt-0.5">
                        {formatShortDate(t.dueDate)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* To pay */}
        <SectionCard title="To pay" to="/costs">
          {unpaid.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-4 text-center">Everything is paid 🎉</p>
          ) : (
            <ul className="space-y-1 -mx-2">
              {unpaid.map((c) => {
                const status = costStatus(c, transactions, accounts, settings);
                const cat = settings.categories.find((x) => x.id === c.categoryId);
                const mkt = costMarketPkr(c, settings);
                const card = costEffectivePkr(c, settings);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/costs?open=${c.id}`)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-[var(--surface-2)]/60 text-left cursor-pointer"
                    >
                      <span className="w-1.5 h-7 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? 'var(--accent)' }} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm truncate">{c.name}</span>
                          {c.maybe && <Chip variant="maybe">Maybe</Chip>}
                        </span>
                        <span className="block text-[11px] text-[var(--text-muted)]">
                          {c.dueDate ? `Due ${formatShortDate(c.dueDate)}` : cat?.name}
                        </span>
                      </span>
                      {status !== 'planned' && (
                        <Chip variant={STATUS_VARIANT[status]} className="hidden sm:inline-flex">
                          {STATUS_LABEL[status]}
                        </Chip>
                      )}
                      <span className="text-right shrink-0">
                        <span className="block text-sm font-semibold num">
                          <Amount pkr={mkt} usd={costNativeUsd(c) ?? undefined} />
                        </span>
                        {Math.round(card) !== Math.round(mkt) && (
                          <span className="block text-[11px] text-[var(--text-faint)] num">
                            card <Amount pkr={card} displayCurrency="PKR" compact tone="muted" />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Money */}
      <SectionCard title="Money" to="/accounts" linkLabel="Manage">
        {liveAccounts.length === 0 ? (
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-muted)]">
            <span>Add your bank or savings to see if you’re covered.</span>
            <Link to="/accounts" className="text-[var(--accent)] font-medium shrink-0">
              Add account
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {liveAccounts.map((acc) => (
              <Link
                key={acc.id}
                to="/accounts"
                className="rounded-[14px] bg-[var(--surface-2)] px-4 py-3 hover:bg-[var(--surface-3)] transition-colors"
              >
                <p className="text-xs text-[var(--text-muted)] truncate">{acc.name}</p>
                <p className="text-base font-semibold num mt-0.5">
                  <Amount
                    pkr={accountBalancePkr(acc, transactions, settings)}
                    usd={acc.currency === 'USD' ? accountBalance(acc, transactions) : undefined}
                    displayCurrency={acc.currency}
                    compact
                  />
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
