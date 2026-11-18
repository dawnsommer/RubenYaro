import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock, ChevronDown, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costTotal,
  getActivePlanCosts,
  selectTotalFundsPkr,
  selectTotalPaidPkr,
} from '../../store/selectors';
import { getConversionContext, moneyToPkr } from '../../lib/currency';
import { parseAmount } from '../../lib/parseAmount';
import { formatDayMonth, formatMonthYear } from '../../lib/dates';
import { Money } from '../../types';
import { Amount, Card, Chip, MoneyInput, Segmented } from '../../components/ui';
import { PageHeader } from '../../components/layout/PageHeader';
import { buildTimeline, Scenario, scenarioTotal, TimelineBucket } from './timeline';

const monthLabel = (key: string) => (key === 'none' ? 'No date yet' : formatMonthYear(`${key}-01`));
const shortMonth = (key: string) => {
  if (key === 'none') return 'Undated';
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};
const fmtK = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : `${Math.round(a)}`;
  return `${v < 0 ? '−' : ''}${s}`;
};

function Stat({
  icon,
  label,
  children,
  sub,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[14px] bg-[var(--surface-2)]/70 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
        <span className="text-[var(--text-faint)]">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-[17px] sm:text-xl font-semibold num tracking-[-0.02em] truncate">{children}</p>
      {sub && <p className="text-[11px] text-[var(--text-faint)] num mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function MonthRow({ b, open, onToggle }: { b: TimelineBucket; open: boolean; onToggle: () => void }) {
  const short = b.balanceAfter < -0.5;
  const empty = b.items.length === 0;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        disabled={empty}
        className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left ${
          empty ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--surface-2)]/60'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            short ? 'bg-[var(--negative)]' : empty ? 'bg-[var(--surface-3)]' : 'bg-[var(--accent)]'
          }`}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium">
            {monthLabel(b.key)}
            {b.index === 0 && b.key !== 'none' && (
              <span className="ml-1.5 text-[11px] text-[var(--text-faint)]">now</span>
            )}
          </span>
          <span className="block text-[11px] text-[var(--text-muted)] truncate">
            {empty ? 'Nothing due' : b.items.map((i) => i.name).join(' · ')}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-sm font-semibold num">
            {empty ? (
              <span className="text-[var(--text-faint)]">—</span>
            ) : (
              <Amount pkr={b.out} prefix="−" compact />
            )}
          </span>
          <span
            className={`block text-[11px] num ${short ? 'text-[var(--negative)] font-medium' : 'text-[var(--text-faint)]'}`}
          >
            left <Amount pkr={b.balanceAfter} compact className="!text-inherit" />
          </span>
        </span>
        {!empty && (
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-faint)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && !empty && (
        <ul className="px-4 sm:px-5 pb-3 -mt-1 space-y-1 animate-fade-in">
          {b.items.map((it, i) => (
            <li key={`${it.costId}-${i}`} className="flex items-center gap-2 pl-5 text-[13px]">
              <Link
                to={`/costs?open=${it.costId}`}
                className="flex-1 min-w-0 truncate hover:text-[var(--accent)]"
              >
                {it.name}
              </Link>
              {it.maybe && <Chip variant="maybe">Maybe</Chip>}
              {it.overdue && <Chip variant="negative">Overdue</Chip>}
              {it.date && (
                <span className="text-[11px] text-[var(--text-faint)] num w-14 text-right">
                  {formatDayMonth(it.date)}
                </span>
              )}
              <span className="num font-medium w-24 text-right">
                <Amount pkr={it.pkr} compact />
              </span>
            </li>
          ))}
          {b.key === 'none' && (
            <li className="pl-5 pt-1 text-[11px] text-[var(--text-faint)]">
              Give these a due date in Costs to place them on the timeline.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function PlannerPage() {
  const state = useStore();
  const { settings, costs, transactions, accounts } = state;
  const ctx = getConversionContext(settings);

  const fundsPkr = selectTotalFundsPkr(state);
  const paidPkr = selectTotalPaidPkr(state);

  const [includeMaybes, setIncludeMaybes] = useState(false);
  const [saveText, setSaveText] = useState('');
  const monthlySave = Math.max(0, parseAmount(saveText) ?? 0);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const tl = useMemo(
    () =>
      buildTimeline({
        costs,
        transactions,
        accounts,
        settings,
        fundsPkr,
        monthlySave,
        includeMaybes,
        goalDate: settings.journey.targetDate,
      }),
    [costs, transactions, accounts, settings, fundsPkr, monthlySave, includeMaybes]
  );
  const buckets = tl.undated ? [...tl.months, tl.undated] : tl.months;
  const firstOpen = openKey ?? buckets.find((b) => b.items.length)?.key ?? null;
  const chartData = buckets.map((b) => ({
    m: shortMonth(b.key),
    out: Math.round(b.out),
    left: Math.round(b.balanceAfter),
  }));
  const next30 = tl.months[0]?.out ?? 0;

  // ---- scenarios -------------------------------------------------------------
  const spareFor = (plan: number) => fundsPkr - Math.max(0, plan - paidPkr);
  const scenarios: { id: Scenario; title: string; hint: string }[] = [
    { id: 'lean', title: 'Lean', hint: 'Musts only · low estimates' },
    { id: 'expected', title: 'Expected', hint: 'Your plan as it is' },
    {
      id: 'comfortable',
      title: 'Comfortable',
      hint: 'High estimates + maybes',
    },
  ];

  // ---- can I afford it -------------------------------------------------------
  const [buy, setBuy] = useState<Money>({ amount: 0, currency: 'USD' });
  const buyPkr = moneyToPkr(buy, ctx);
  const planSpare = spareFor(
    getActivePlanCosts(costs)
      .filter((c) => !c.maybe)
      .reduce((s, c) => s + costTotal(c, settings), 0)
  );

  // ---- dollar moves ----------------------------------------------------------
  const [ratePct, setRatePct] = useState(0);
  const planAt = (pct: number) => {
    const s = {
      ...settings,
      rates: {
        ...settings.rates,
        market: settings.rates.market * (1 + pct / 100),
        effective: settings.rates.effective * (1 + pct / 100),
      },
    };
    return getActivePlanCosts(costs)
      .filter((c) => !c.maybe)
      .reduce((sum, c) => sum + costTotal(c, s), 0);
  };
  const basePlan = planAt(0);
  const movedPlan = planAt(ratePct);
  const per10 = useMemo(() => {
    const s = {
      ...settings,
      rates: {
        ...settings.rates,
        market: settings.rates.market + 10,
        effective: settings.rates.effective + 10,
      },
    };
    return (
      getActivePlanCosts(costs)
        .filter((c) => !c.maybe)
        .reduce((sum, c) => sum + costTotal(c, s), 0) - basePlan
    );
  }, [costs, settings, basePlan]);

  const short = tl.firstShortKey !== null;

  return (
    <div className="space-y-4">
      <PageHeader title="Planner" subtitle="When your money goes out, month by month" />

      {/* ---------- timeline ---------- */}
      <Card noPadding>
        <div className="p-4 sm:p-5 pb-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className={`inline-flex items-center gap-2 text-sm font-semibold ${
                short ? 'text-[var(--negative)]' : 'text-[var(--positive)]'
              }`}
            >
              {short ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {!short
                ? 'Your money lasts the whole plan'
                : tl.firstShortKey === 'none'
                  ? 'Your undated costs leave you short'
                  : `You run short in ${monthLabel(tl.firstShortKey!)}`}
            </div>
            <Segmented
              ariaLabel="Include maybes"
              size="sm"
              options={[
                { value: 'no', label: 'Confirmed' },
                { value: 'yes', label: '+ Maybes' },
              ]}
              value={includeMaybes ? 'yes' : 'no'}
              onChange={(v) => setIncludeMaybes(v === 'yes')}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat icon={<Wallet className="w-3.5 h-3.5" />} label="Money now">
              <Amount pkr={fundsPkr} compact />
            </Stat>
            <Stat
              icon={<CalendarClock className="w-3.5 h-3.5" />}
              label="Still to pay"
              sub={
                <>
                  this month <Amount pkr={next30} compact tone="muted" />
                </>
              }
            >
              <Amount pkr={tl.totalOut} compact />
            </Stat>
            <Stat
              icon={<TrendingDown className="w-3.5 h-3.5" />}
              label="Lowest point"
              sub={tl.lowest ? monthLabel(tl.lowest.key) : undefined}
            >
              <Amount
                pkr={tl.lowest?.balance ?? fundsPkr}
                compact
                tone={(tl.lowest?.balance ?? 0) < 0 ? 'negative' : 'positive'}
              />
            </Stat>
            <Stat
              icon={<PiggyBank className="w-3.5 h-3.5" />}
              label="Save to stay covered"
              sub={
                tl.saveNeeded === Infinity
                  ? 'short this month already'
                  : tl.saveNeeded
                    ? tl.needsGoalDate
                      ? 'for dated costs · add an undated date'
                      : 'every month from next'
                    : tl.needsGoalDate
                      ? 'set “undated due by” below'
                      : 'nothing needed'
              }
            >
              {tl.saveNeeded === null && tl.needsGoalDate ? (
                <span className="text-[var(--text-faint)]">—</span>
              ) : tl.saveNeeded === null ? (
                <span className="text-[var(--positive)]">₨0</span>
              ) : tl.saveNeeded === Infinity ? (
                <span className="text-[var(--negative)]">Now</span>
              ) : (
                <>
                  <Amount pkr={tl.saveNeeded} compact />
                  <span className="text-xs font-medium text-[var(--text-faint)]">/mo</span>
                </>
              )}
            </Stat>
          </div>

          <div className="h-48 sm:h-56 -mx-2" aria-label="Money left and payments by month">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                  tickFormatter={fmtK}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <ReferenceLine y={0} stroke="var(--border-strong)" />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [
                    `₨ ${Math.round(v).toLocaleString('en-US')}`,
                    name,
                  ]}
                />
                <Bar
                  dataKey="out"
                  name="Paying out"
                  isAnimationActive={false}
                  fill="var(--accent)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  dataKey="left"
                  name="Money left"
                  isAnimationActive={false}
                  type="monotone"
                  stroke="var(--positive)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--positive)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent)]" /> Paying out
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="w-2.5 h-0.5 rounded-full bg-[var(--positive)]" /> Money left
              </span>
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2">
              {tl.undated && (
                <label className="inline-flex items-center gap-2">
                  <span>Undated due by</span>
                  <input
                    type="date"
                    value={settings.journey.targetDate ?? ''}
                    onChange={(e) =>
                      state.updateSettings({
                        journey: {
                          ...settings.journey,
                          targetDate: e.target.value || null,
                        },
                      })
                    }
                    aria-label="Undated costs due by"
                    className="field !w-auto !py-1 !px-2.5 !rounded-full num text-xs"
                  />
                </label>
              )}
              <label className="inline-flex items-center gap-2">
                <span>I can save</span>
                <span className="field !w-28 !py-1 !px-2.5 flex items-center gap-1 !rounded-full">
                  <span className="text-[var(--text-faint)]">₨</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={saveText}
                    onChange={(e) => setSaveText(e.target.value)}
                    placeholder="0"
                    aria-label="Saving per month (PKR)"
                    className="w-full bg-transparent outline-none num text-xs text-[var(--text)]"
                  />
                </span>
                <span>/ month</span>
              </label>
            </span>
          </div>
        </div>

        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {buckets.map((b) => (
            <MonthRow
              key={b.key}
              b={b}
              open={firstOpen === b.key}
              onToggle={() => setOpenKey(firstOpen === b.key ? '' : b.key)}
            />
          ))}
        </div>
        <p className="px-4 sm:px-5 py-3 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)]">
          Amounts are what's still unpaid, after tax. Overdue costs count in this month
          {tl.undated && settings.journey.targetDate
            ? `; undated ones by ${monthLabel(settings.journey.targetDate.slice(0, 7))}`
            : ''}
          .
        </p>
      </Card>

      {/* ---------- scenarios ---------- */}
      <Card title="Scenarios" subtitle="Same money, different plans. Nothing here changes your costs.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {scenarios.map((s) => {
            const plan = scenarioTotal(costs, settings, s.id);
            const spare = spareFor(plan);
            return (
              <div
                key={s.id}
                className={`rounded-[14px] p-3.5 ${
                  s.id === 'expected'
                    ? 'bg-[var(--accent-soft)]/60 ring-1 ring-[var(--accent)]/30'
                    : 'bg-[var(--surface-2)]/70'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">{s.hint}</p>
                </div>
                <p
                  className={`mt-2 text-xl font-semibold num tracking-[-0.02em] ${spare >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}`}
                >
                  <Amount
                    pkr={Math.abs(spare)}
                    prefix={spare >= 0 ? '+' : '−'}
                    compact
                    className="!text-inherit"
                  />
                  <span className="ml-1 text-xs font-medium text-[var(--text-muted)]">
                    {spare >= 0 ? 'spare' : 'short'}
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)] num mt-0.5">
                  plan <Amount pkr={plan} compact tone="muted" />
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- can I afford it ---------- */}
        <Card title="Can I afford it?" subtitle="Something new that isn't in your plan.">
          <MoneyInput value={buy} onChange={setBuy} placeholder="e.g. 900, 1.2k, 3 lakh" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-[var(--surface-2)]/70 px-3 py-2.5">
              <p className="text-[11px] text-[var(--text-muted)]">Money left today</p>
              <p className="text-base font-semibold num">
                <Amount
                  pkr={fundsPkr - buyPkr}
                  compact
                  tone={fundsPkr - buyPkr >= 0 ? 'default' : 'negative'}
                />
              </p>
            </div>
            <div className="rounded-[12px] bg-[var(--surface-2)]/70 px-3 py-2.5">
              <p className="text-[11px] text-[var(--text-muted)]">Spare after the plan</p>
              <p className="text-base font-semibold num">
                <Amount
                  pkr={Math.abs(planSpare - buyPkr)}
                  prefix={planSpare - buyPkr >= 0 ? '+' : '−'}
                  compact
                  tone={planSpare - buyPkr >= 0 ? 'positive' : 'negative'}
                />
              </p>
            </div>
          </div>
          {buyPkr > 0 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {planSpare - buyPkr >= 0
                ? 'Yes — the plan stays covered.'
                : planSpare >= 0
                  ? 'Only by eating into money the plan needs.'
                  : 'The plan is already short; this adds to it.'}
            </p>
          )}
        </Card>

        {/* ---------- dollar moves ---------- */}
        <Card
          title="If the dollar moves"
          subtitle="Both rates move together."
          action={
            ratePct !== 0 ? (
              <button
                type="button"
                onClick={() => setRatePct(0)}
                className="text-xs font-medium text-[var(--accent)] cursor-pointer"
              >
                Reset
              </button>
            ) : undefined
          }
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--text-muted)] num">
              ₨{(settings.rates.market * (1 + ratePct / 100)).toFixed(1)} market · ₨
              {(settings.rates.effective * (1 + ratePct / 100)).toFixed(1)} card
            </span>
            <span
              className={`font-semibold num ${ratePct > 0 ? 'text-[var(--negative)]' : ratePct < 0 ? 'text-[var(--positive)]' : ''}`}
            >
              {ratePct > 0 ? '+' : ''}
              {ratePct}%
            </span>
          </div>
          <input
            type="range"
            min={-10}
            max={20}
            step={1}
            value={ratePct}
            onChange={(e) => setRatePct(Number(e.target.value))}
            aria-label="Dollar rate change"
            className="w-full accent-[var(--accent)]"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-[var(--surface-2)]/70 px-3 py-2.5">
              <p className="text-[11px] text-[var(--text-muted)]">Plan becomes</p>
              <p className="text-base font-semibold num">
                <Amount pkr={movedPlan} compact />
              </p>
              <p className="text-[11px] text-[var(--text-faint)] num">
                {movedPlan - basePlan >= 0 ? '+' : '−'}
                <Amount pkr={Math.abs(movedPlan - basePlan)} compact tone="muted" />
              </p>
            </div>
            <div className="rounded-[12px] bg-[var(--surface-2)]/70 px-3 py-2.5">
              <p className="text-[11px] text-[var(--text-muted)]">Spare after the plan</p>
              <p className="text-base font-semibold num">
                <Amount
                  pkr={Math.abs(spareFor(movedPlan))}
                  prefix={spareFor(movedPlan) >= 0 ? '+' : '−'}
                  compact
                  tone={spareFor(movedPlan) >= 0 ? 'positive' : 'negative'}
                />
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)] num">
            Every +₨10 per dollar adds <Amount pkr={per10} compact tone="warning" /> to your plan.
          </p>
        </Card>
      </div>
    </div>
  );
}
