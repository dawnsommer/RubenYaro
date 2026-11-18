import { ReactNode } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Amount } from '../../components/ui';
import type { Settings } from '../../types';

export interface PlanHeroProps {
  settings: Settings;
  includeMaybes: boolean;
  onToggleMaybes: () => void;
  fundsPkr: number;
  paidPkr: number;
  planMarketPkr: number;
  planCardPkr: number;
  maybeExtraCardPkr: number; // what the maybes would add (after tax)
  costCount: number;
  usdShare: number; // $ amount of the plan that is priced in USD
}

/** One way of looking at the plan (after-tax card rate, or market rate). */
function Lens({
  title,
  rate,
  gap,
  plan,
  primary,
}: {
  title: string;
  rate: string;
  gap: number;
  plan: number;
  primary?: boolean;
}) {
  const ok = gap >= 0;
  return (
    <div
      className={`rounded-[18px] p-4 sm:p-5 ${
        primary ? 'bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--border)]' : 'bg-[var(--surface-2)]/70'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <p className="text-[12px] font-semibold text-[var(--text)] whitespace-nowrap">{title}</p>
        <span className="text-[11px] num text-[var(--text-faint)] whitespace-nowrap">{rate}</span>
      </div>
      <p
        className={`mt-2 text-[26px] sm:text-[34px] leading-none font-semibold tracking-[-0.04em] num ${
          ok ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
        }`}
      >
        {/* compact on phones so two lenses fit side by side */}
        <Amount pkr={Math.abs(gap)} prefix={ok ? '+' : '−'} compact className="!text-inherit sm:!hidden" />
        <Amount pkr={Math.abs(gap)} prefix={ok ? '+' : '−'} className="!text-inherit !hidden sm:!inline-flex" />
      </p>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{ok ? 'spare after everything' : 'short'}</p>
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-faint)] whitespace-nowrap">
          Total plan
        </span>
        <span className="text-sm font-semibold num">
          <Amount pkr={plan} compact className="sm:!hidden" />
          <Amount pkr={plan} className="!hidden sm:!inline-flex" />
        </span>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--text-faint)]">{label}</p>
      <p className="text-[13px] font-medium num mt-0.5 truncate">{children}</p>
    </div>
  );
}

export function PlanHero(p: PlanHeroProps) {
  const leftCard = Math.max(0, p.planCardPkr - p.paidPkr);
  const leftMarket = Math.max(0, p.planMarketPkr - p.paidPkr);
  const gapCard = p.fundsPkr - leftCard;
  const gapMarket = p.fundsPkr - leftMarket;
  const ok = gapCard >= 0;

  // bar: paid | still to pay | spare — on the scale of whichever is bigger, money+paid or plan
  const scale = Math.max(p.planCardPkr, p.fundsPkr + p.paidPkr, 1);
  const paidW = (p.paidPkr / scale) * 100;
  const leftW = (Math.min(leftCard, p.fundsPkr) / scale) * 100;
  const shortW = ok ? 0 : ((leftCard - p.fundsPkr) / scale) * 100;
  const spareW = ok ? (gapCard / scale) * 100 : 0;

  return (
    <section className="card relative overflow-hidden p-4 sm:p-6">
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'linear-gradient(135deg, var(--hero-from), var(--hero-to))' }}
      />
      <div className="relative">
        {/* verdict */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-9 h-9 rounded-[12px] grid place-items-center ${
                ok ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--negative-soft)] text-[var(--negative)]'
              }`}
            >
              {ok ? <ShieldCheck className="w-5 h-5" /> : <TriangleAlert className="w-5 h-5" />}
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">
                {ok ? 'Your money covers the plan' : 'Your money doesn’t cover the plan yet'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {p.costCount} costs · {p.includeMaybes ? 'including maybes' : 'confirmed only'}
              </p>
            </div>
          </div>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => v !== p.includeMaybes && p.onToggleMaybes()}
                className={`h-7 px-3 rounded-full transition-colors cursor-pointer ${
                  p.includeMaybes === v
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {v ? '+ Maybes' : 'Confirmed'}
              </button>
            ))}
          </div>
        </div>

        {/* the two views, side by side */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          <Lens
            primary
            title="After tax"
            rate={`₨${p.settings.rates.effective}/$`}
            gap={gapCard}
            plan={p.planCardPkr}
          />
          <Lens
            title="At market"
            rate={`₨${p.settings.rates.market.toFixed(1)}/$`}
            gap={gapMarket}
            plan={p.planMarketPkr}
          />
        </div>

        {/* bar */}
        <div className="mt-5">
          <div className="h-2.5 rounded-full bg-[var(--surface-3)] overflow-hidden flex">
            <div className="bg-[var(--positive)]" style={{ width: `${paidW}%` }} title="Paid" />
            <div className="bg-[var(--accent)]" style={{ width: `${leftW}%` }} title="Still to pay (after tax)" />
            {shortW > 0 && (
              <div
                className="bg-[var(--negative)]"
                style={{
                  width: `${shortW}%`,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,.35) 4px 8px)',
                }}
                title="Short"
              />
            )}
            {spareW > 0 && <div className="bg-[var(--accent)] opacity-25" style={{ width: `${spareW}%` }} title="Spare" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[var(--positive)]" /> Paid
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-full bg-[var(--accent)]" /> To pay
            </span>
            {ok ? (
              <span className="inline-flex items-center gap-1.5">
                <i className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-25" /> Spare
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <i className="w-2 h-2 rounded-full bg-[var(--negative)]" /> Short
              </span>
            )}
          </div>
        </div>

        {/* details: smaller, but everything is here */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Detail label="My money">
            <Amount pkr={p.fundsPkr} />
          </Detail>
          <Detail label="Paid so far">
            <Amount pkr={p.paidPkr} tone={p.paidPkr > 0 ? 'positive' : 'default'} />
          </Detail>
          <Detail label="Left to pay (after tax · market)">
            <Amount pkr={leftCard} compact /> <span className="text-[var(--text-faint)]">·</span>{' '}
            <Amount pkr={leftMarket} compact tone="muted" />
          </Detail>
          <Detail label={p.includeMaybes ? 'Maybes (included)' : 'Maybes would add'}>
            <Amount pkr={p.maybeExtraCardPkr} compact prefix="+" className="!text-[var(--maybe)]" />
          </Detail>
          {p.usdShare > 0 && (
            <Detail label="Priced in dollars">
              <Amount pkr={p.usdShare * p.settings.rates.market} usd={p.usdShare} displayCurrency="USD" compact />
            </Detail>
          )}
          <Detail label="Tax on dollar costs">
            <Amount pkr={Math.max(0, p.planCardPkr - p.planMarketPkr)} compact tone="muted" />
          </Detail>
        </div>
      </div>
    </section>
  );
}
