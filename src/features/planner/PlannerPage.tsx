import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { addMonths, differenceInMonths, format, parseISO, isValid } from 'date-fns';
import { Copy, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  costMaybeExtra,
  costSource,
  costTotal,
  getActivePlanCosts,
  selectGapPkr,
  selectPlanTotalPkr,
  selectRemainingPkr,
  selectTotalFundsPkr,
  selectTotalPaidPkr,
} from '../../store/selectors';
import {
  computeBreakdown,
  getConversionContext,
  moneyToPkr,
  pkrToUsd,
  usdToPkr,
} from '../../lib/currency';
import { ConversionMode, Money } from '../../types';
import {
  Amount,
  Button,
  Card,
  Chip,
  DateInput,
  MoneyInput,
  Segmented,
  Select,
} from '../../components/ui';
import { parseAmount } from '../../lib/parseAmount';

type ScenarioMode = 'lean' | 'expected' | 'comfortable';

export function PlannerPage() {
  const state = useStore();
  const { settings, costs } = state;

  // 1. Affordability check state
  const [selectedCostId, setSelectedCostId] = useState<string>(costs[0]?.id ?? 'custom');
  const [customAffordMoney, setCustomAffordMoney] = useState<Money>({
    amount: 500,
    currency: 'USD',
  });

  // 2. Savings goal state
  const [goalDate, setGoalDate] = useState<string | null>(
    settings.journey.targetDate ?? '2027-09-01'
  );

  // 3. Rate what-if state
  const [whatIfMarket, setWhatIfMarket] = useState<number>(settings.rates.market);
  const [whatIfEffective, setWhatIfEffective] = useState<number>(
    settings.rates.effective
  );

  // 4. Quick converter state
  const [convMode, setConvMode] = useState<ConversionMode>(
    settings.defaultConversionMode
  );
  const [convTaxPct, setConvTaxPct] = useState<number>(settings.defaultTax.value);
  const [convUsdText, setConvUsdText] = useState<string>('1000');
  const [convPkrText, setConvPkrText] = useState<string>(() =>
    String(
      Math.round(
        usdToPkr(
          1000,
          settings.defaultConversionMode,
          settings.rates.market,
          settings.rates.effective,
          settings.defaultTax
        )
      )
    )
  );
  const [copied, setCopied] = useState(false);

  // 5. Scenario toggles state
  const [scenario, setScenario] = useState<ScenarioMode>('expected');

  const ctx = getConversionContext(settings);
  const totalFundsPkr = selectTotalFundsPkr(state);
  const totalPaidPkr = selectTotalPaidPkr(state);
  const basePlanPkr = selectPlanTotalPkr(state);

  // 1. Affordability calculation
  const selectedCostObj =
    selectedCostId === 'custom'
      ? null
      : costs.find((c) => c.id === selectedCostId) ?? null;
  const affordAmountPkr = selectedCostObj
    ? costTotal(selectedCostObj, settings)
    : moneyToPkr(customAffordMoney, ctx);

  const fundsAfterAffordPkr = totalFundsPkr - affordAmountPkr;
  const coverageAfterAfford =
    basePlanPkr > 0
      ? Math.max(0, ((totalPaidPkr + fundsAfterAffordPkr) / basePlanPkr) * 100)
      : 100;

  // 2. Savings goal & monthly cash-flow chart
  const gapPkr = selectGapPkr(state, false);
  const shortfallPkr = Math.max(0, -gapPkr);
  const monthsRemaining = useMemo(() => {
    if (!goalDate) return 6;
    try {
      const target = parseISO(goalDate);
      if (!isValid(target)) return 6;
      return Math.max(1, differenceInMonths(target, new Date()));
    } catch {
      return 6;
    }
  }, [goalDate]);

  const monthlySaveNeededPkr = shortfallPkr / monthsRemaining;

  const cashFlowData = useMemo(() => {
    const active = getActivePlanCosts(costs).filter((c) => !c.maybe);
    const totalRemaining = selectRemainingPkr(state, false);
    const count = Math.min(24, Math.max(3, monthsRemaining));
    const now = new Date();
    const rows: {
      month: string;
      projectedFunds: number;
      cumulativeCosts: number;
      net: number;
    }[] = [];

    let firstNegativeMonth: string | null = null;
    for (let i = 0; i <= count; i++) {
      const mDate = addMonths(now, i);
      const mLabel = format(mDate, 'MMM yy');
      const mIso = format(mDate, 'yyyy-MM-dd');

      // Scheduled costs due up to mIso, or evenly distributed if unscheduled
      const scheduledUpTo = active
        .filter((c) => c.dueDate && c.dueDate <= mIso)
        .reduce((s, c) => s + costTotal(c, settings), 0);
      const unscheduledTotal = active
        .filter((c) => !c.dueDate)
        .reduce((s, c) => s + costTotal(c, settings), 0);
      const cumCost = Math.min(
        totalRemaining,
        scheduledUpTo + (unscheduledTotal * i) / count
      );
      const projFunds = totalFundsPkr + monthlySaveNeededPkr * i;
      const net = projFunds - cumCost;
      if (net < 0 && !firstNegativeMonth) firstNegativeMonth = mLabel;

      rows.push({
        month: mLabel,
        projectedFunds: Math.round(projFunds),
        cumulativeCosts: Math.round(cumCost),
        net: Math.round(net),
      });
    }
    return { rows, firstNegativeMonth };
  }, [
    costs,
    monthsRemaining,
    state,
    settings,
    totalFundsPkr,
    monthlySaveNeededPkr,
  ]);

  // 3. Rate what-if calculation
  const whatIfSettings = useMemo(
    () => ({
      ...settings,
      rates: {
        ...settings.rates,
        market: whatIfMarket,
        effective: whatIfEffective,
      },
    }),
    [settings, whatIfMarket, whatIfEffective]
  );

  const whatIfPlanPkr = useMemo(() => {
    return getActivePlanCosts(costs)
      .filter((c) => !c.maybe)
      .reduce((s, c) => s + costTotal(c, whatIfSettings), 0);
  }, [costs, whatIfSettings]);

  const whatIfGapPkr = totalFundsPkr - Math.max(0, whatIfPlanPkr - totalPaidPkr);

  // Delta per +10 PKR/USD
  const plusTenSettings = useMemo(
    () => ({
      ...settings,
      rates: {
        ...settings.rates,
        market: settings.rates.market + 10,
        effective: settings.rates.effective + 10,
      },
    }),
    [settings]
  );

  const plusTenDeltaPkr = useMemo(() => {
    const plusTenPlan = getActivePlanCosts(costs)
      .filter((c) => !c.maybe)
      .reduce((s, c) => s + costTotal(c, plusTenSettings), 0);
    return Math.max(0, plusTenPlan - basePlanPkr);
  }, [costs, plusTenSettings, basePlanPkr]);

  // 4. Quick converter handlers
  const handleConvUsdChange = (raw: string) => {
    setConvUsdText(raw);
    const val = parseAmount(raw);
    if (val !== null && val >= 0) {
      const pkr = usdToPkr(val, convMode, settings.rates.market, settings.rates.effective, {
        kind: 'percent',
        value: convTaxPct,
      });
      setConvPkrText(String(Math.round(pkr)));
    }
  };

  const handleConvPkrChange = (raw: string) => {
    setConvPkrText(raw);
    const val = parseAmount(raw);
    if (val !== null && val >= 0) {
      const usd = pkrToUsd(val, convMode, settings.rates.market, settings.rates.effective, {
        kind: 'percent',
        value: convTaxPct,
      });
      setConvUsdText(String(Math.round(usd * 100) / 100));
    }
  };

  const handleConvModeChange = (m: ConversionMode) => {
    setConvMode(m);
    const usdVal = parseAmount(convUsdText) ?? 0;
    const pkr = usdToPkr(usdVal, m, settings.rates.market, settings.rates.effective, {
      kind: 'percent',
      value: convTaxPct,
    });
    setConvPkrText(String(Math.round(pkr)));
  };

  const convUsdNum = parseAmount(convUsdText) ?? 0;
  const convBreakdown = computeBreakdown(
    { amount: convUsdNum, currency: 'USD' },
    ctx,
    convMode,
    { kind: 'percent', value: convTaxPct }
  );

  // 5. Scenario calculation (Lean / Expected / Comfortable — display-only, §6.5)
  const scenarioPlanPkr = useMemo(() => {
    const active = getActivePlanCosts(costs);
    let sum = 0;
    for (const c of active) {
      if (scenario === 'lean') {
        if (c.maybe || c.priority !== 'must') continue;
      } else if (scenario === 'expected') {
        if (c.maybe) continue;
      }
      // Comfortable includes all priorities + maybes
      const src = costSource(c);
      const occ = c.recurrence?.occurrences ?? 1;
      if (src.range && src.subCosts.length === 0) {
        const bound =
          scenario === 'lean'
            ? src.range.low
            : scenario === 'comfortable'
              ? src.range.high
              : src.money.amount;
        sum +=
          moneyToPkr(
            { amount: bound, currency: src.money.currency },
            ctx,
            c.conversionMode,
            c.tax
          ) * occ;
      } else {
        sum += costTotal(c, settings);
      }
      if (scenario === 'comfortable') {
        sum += costMaybeExtra(c, settings);
      }
    }
    return sum;
  }, [costs, scenario, ctx, settings]);

  const scenarioGapPkr = totalFundsPkr - Math.max(0, scenarioPlanPkr - totalPaidPkr);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-micro">Simulations &amp; Calculators</p>
        <h1 className="text-[24px] leading-[32px] font-semibold mt-1">Planner</h1>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 5. Scenario toggles (§6.5) */}
        <Card
          className="col-span-12"
          title="Scenario comparison"
          subtitle="Display-only simulation — does not mutate your saved costs."
          action={
            <Segmented
              ariaLabel="Scenario selector"
              options={[
                { value: 'lean', label: 'Lean (low + must)' },
                { value: 'expected', label: 'Expected (mid)' },
                { value: 'comfortable', label: 'Comfortable (high + maybes)' },
              ]}
              value={scenario}
              onChange={setScenario}
            />
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)]">
              <p className="label-micro">Scenario plan total</p>
              <p className="text-xl font-semibold num mt-1">
                <Amount pkr={scenarioPlanPkr} showSecondary />
              </p>
            </div>
            <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)]">
              <p className="label-micro">Available funds</p>
              <p className="text-xl font-semibold num mt-1">
                <Amount pkr={totalFundsPkr} showSecondary />
              </p>
            </div>
            <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)]">
              <p className="label-micro">Scenario gap</p>
              <p className="text-xl font-semibold num mt-1">
                <Amount
                  pkr={Math.abs(scenarioGapPkr)}
                  tone={scenarioGapPkr >= 0 ? 'positive' : 'negative'}
                />{' '}
                <span className="text-xs font-medium">
                  {scenarioGapPkr >= 0 ? 'surplus' : 'short'}
                </span>
              </p>
            </div>
          </div>
        </Card>

        {/* 1. Affordability check (§6.5) */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="Affordability check"
          subtitle="See the immediate impact of paying a specific cost."
        >
          <div className="space-y-4">
            <Select
              label="Pick a cost (or custom amount)"
              value={selectedCostId}
              onChange={setSelectedCostId}
              options={[
                ...costs.map((c) => ({ value: c.id, label: c.name })),
                { value: 'custom', label: 'Custom amount…' },
              ]}
            />

            {selectedCostId === 'custom' && (
              <MoneyInput
                label="Custom amount"
                value={customAffordMoney}
                onChange={setCustomAffordMoney}
              />
            )}

            <div className="p-4 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5 text-sm">
              <p>
                Cost amount:{' '}
                <strong className="num">
                  <Amount pkr={affordAmountPkr} showSecondary />
                </strong>
              </p>
              <p>
                After paying this you&apos;ll have{' '}
                <strong className="num">
                  <Amount
                    pkr={fundsAfterAffordPkr}
                    tone={fundsAfterAffordPkr >= 0 ? 'positive' : 'negative'}
                  />
                </strong>{' '}
                left; plan coverage becomes{' '}
                <strong className="num">{Math.round(coverageAfterAfford)}%</strong>.
              </p>
            </div>
          </div>
        </Card>

        {/* 3. Rate what-if (§6.5) */}
        <Card
          className="col-span-12 lg:col-span-6"
          title="Exchange rate what-if"
          subtitle="Slide market or card rate to test PKR depreciation sensitivity."
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setWhatIfMarket(settings.rates.market);
                setWhatIfEffective(settings.rates.effective);
              }}
            >
              Reset
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-muted)]">Market rate</span>
                <span className="font-semibold num">₨ {whatIfMarket} / USD</span>
              </div>
              <input
                type="range"
                min={Math.round(settings.rates.market * 0.75)}
                max={Math.round(settings.rates.market * 1.25)}
                step="1"
                value={whatIfMarket}
                onChange={(e) => setWhatIfMarket(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-muted)]">Card / Effective rate</span>
                <span className="font-semibold num">₨ {whatIfEffective} / USD</span>
              </div>
              <input
                type="range"
                min={Math.round(settings.rates.effective * 0.75)}
                max={Math.round(settings.rates.effective * 1.25)}
                step="1"
                value={whatIfEffective}
                onChange={(e) => setWhatIfEffective(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>

            <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Recalculated plan:</span>
                <span className="font-semibold num">
                  <Amount pkr={whatIfPlanPkr} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Recalculated gap:</span>
                <span className="font-semibold num">
                  <Amount
                    pkr={Math.abs(whatIfGapPkr)}
                    tone={whatIfGapPkr >= 0 ? 'positive' : 'negative'}
                  />{' '}
                  {whatIfGapPkr >= 0 ? 'surplus' : 'short'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] pt-1 num">
                Every +₨10/USD adds{' '}
                <Amount pkr={plusTenDeltaPkr} tone="warning" /> to your confirmed
                plan.
              </p>
            </div>
          </div>
        </Card>

        {/* 2. Savings goal + cash-flow chart (§6.5) */}
        <Card
          className="col-span-12"
          title="Savings goal &amp; cash-flow projection"
          action={
            <div className="w-44">
              <DateInput value={goalDate} onChange={setGoalDate} />
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {shortfallPkr <= 0 ? (
                <p className="text-[var(--positive)] font-medium">
                  Your confirmed plan is already fully funded with a{' '}
                  <Amount pkr={gapPkr} tone="positive" /> surplus!
                </p>
              ) : (
                <p>
                  Save{' '}
                  <strong className="num text-[var(--accent)]">
                    <Amount pkr={monthlySaveNeededPkr} />
                  </strong>{' '}
                  / month for <strong>{monthsRemaining} months</strong> to close the{' '}
                  <Amount pkr={shortfallPkr} tone="negative" /> gap.
                </p>
              )}
              {cashFlowData.firstNegativeMonth && (
                <Chip variant="negative">
                  Funds dip below cumulative costs in {cashFlowData.firstNegativeMonth}
                </Chip>
              )}
            </div>

            <div className="h-56 w-full" aria-label="Cash flow projection chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData.rows}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) =>
                      `₨ ${Math.round(val).toLocaleString('en-US')}`
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="projectedFunds"
                    name="Projected Funds"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeCosts"
                    name="Cumulative Costs"
                    stroke="#4F46E5"
                    fill="#4F46E5"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* 4. Quick converter (§6.5) */}
        <Card
          className="col-span-12"
          title="Quick converter"
          action={
            <div className="flex items-center gap-2">
              <Segmented
                ariaLabel="Converter mode"
                options={[
                  { value: 'market', label: 'Market' },
                  {
                    value: 'effective',
                    label: `Card ${settings.rates.effective}`,
                  },
                  { value: 'detailed', label: 'Detailed' },
                ]}
                value={convMode}
                onChange={handleConvModeChange}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const line = `$${convBreakdown.usd.toLocaleString()} = ₨ ${Math.round(
                    convBreakdown.totalPkr
                  ).toLocaleString()}`;
                  navigator.clipboard?.writeText(line);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[var(--positive)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <div className="rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-2.5 flex items-center gap-2">
              <input
                type="text"
                aria-label="USD amount"
                value={convUsdText}
                onChange={(e) => handleConvUsdChange(e.target.value)}
                className="bg-transparent flex-1 outline-none num text-lg font-medium"
              />
              <Chip>USD</Chip>
            </div>

            <span className="text-[var(--text-muted)] text-center">⇄</span>

            <div className="rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-2.5 flex items-center gap-2">
              <input
                type="text"
                aria-label="PKR amount"
                value={convPkrText}
                onChange={(e) => handleConvPkrChange(e.target.value)}
                className="bg-transparent flex-1 outline-none num text-lg font-medium"
              />
              <Chip>PKR</Chip>
            </div>
          </div>

          {convMode === 'detailed' && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Tax (%):</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={convTaxPct}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value) || 0;
                  setConvTaxPct(pct);
                  const usdVal = parseAmount(convUsdText) ?? 0;
                  const pkr = usdToPkr(
                    usdVal,
                    'detailed',
                    settings.rates.market,
                    settings.rates.effective,
                    { kind: 'percent', value: pct }
                  );
                  setConvPkrText(String(Math.round(pkr)));
                }}
                className="w-20 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 num outline-none"
              />
            </div>
          )}

          <p className="mt-3 text-sm text-[var(--text-muted)] num">
            <Amount
              pkr={convBreakdown.marketPkr}
              usd={convBreakdown.usd}
              displayCurrency="USD"
              tone="muted"
            />{' '}
            × ₨{settings.rates.market.toFixed(2)} ={' '}
            <Amount pkr={convBreakdown.marketPkr} displayCurrency="PKR" tone="muted" />
            {convBreakdown.tax !== 0 && (
              <>
                {' '}
                + markup/tax{' '}
                <Amount pkr={convBreakdown.tax} displayCurrency="PKR" tone="muted" />
              </>
            )}{' '}
            = <Amount pkr={convBreakdown.totalPkr} displayCurrency="PKR" /> · at card
            rate:{' '}
            <Amount
              pkr={convBreakdown.usd * settings.rates.effective}
              displayCurrency="PKR"
              tone="muted"
            />
          </p>
        </Card>
      </div>
    </div>
  );
}
