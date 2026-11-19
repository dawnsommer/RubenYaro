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

/** Big number: compact on phones so the two boxes fit side by side. */
function Big({ pkr, prefix, className = '' }: { pkr: number; prefix?: string; className?: string }) {
  return (
    <p
      className={`text-[26px] sm:text-[38px] leading-none font-semibold tracking-[-0.04em] num ${className}`}
    >
      <Amount pkr={pkr} prefix={prefix} compact className="!text-inherit sm:!hidden" />
      <Amount pkr={pkr} prefix={prefix} className="!text-inherit !hidden sm:!inline-flex" />
    </p>
  );
}

function Box({
  title,
  aside,
  children,
  tint,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  tint?: string;
}) {
  return (
    <div
      className="rounded-[18px] p-4 sm:p-5 bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--border)] min-w-0"
      style={
        tint
          ? {
              backgroundImage: `linear-gradient(160deg, ${tint}, transparent 70%)`,
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-[12px] font-semibold text-[var(--text-muted)] whitespace-nowrap">{title}</p>
        {aside}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

const sign = (n: number) => (n >= 0 ? '+' : '−');

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
  const okMarket = gapMarket >= 0;

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
        style={{
          background: 'linear-gradient(135deg, var(--hero-from), var(--hero-to))',
        }}
      />
      <div className="relative">
        {/* verdict */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-9 h-9 rounded-[12px] grid place-items-center ${
                ok
                  ? 'bg-[var(--positive-soft)] text-[var(--positive)]'
                  : 'bg-[var(--negative-soft)] text-[var(--negative)]'
              }`}
            >
              {ok ? <ShieldCheck className="w-5 h-5" /> : <TriangleAlert className="w-5 h-5" />}
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">
                {ok ? 'Your money covers the plan' : 'Your money doesn’t cover the plan yet'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {p.includeMaybes ? 'Including maybes' : 'Confirmed costs only'} · after tax
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

        {/* the two numbers that matter */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          <Box
            title="Total cost"
            aside={
              <span className="max-sm:hidden text-[11px] num text-[var(--text-faint)] whitespace-nowrap">
                {p.costCount} costs
              </span>
            }
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
              After tax
            </p>
            <Big pkr={p.planCardPkr} />
            <div className="mt-2 pt-2 border-t border-[var(--border)] flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">before tax</span>
              <span className="text-[15px] sm:text-lg font-semibold num tracking-[-0.02em] text-[var(--text-muted)]">
                <Amount pkr={p.planMarketPkr} compact className="!text-inherit" />
              </span>
            </div>
          </Box>
          <Box
            title={
              <>
                <span className="sm:hidden">Spare after all</span>
                <span className="max-sm:hidden">Spare after everything</span>
              </>
            }
            tint={ok ? 'var(--positive-soft)' : 'var(--negative-soft)'}
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
              After tax
            </p>
            <Big
              pkr={Math.abs(gapCard)}
              prefix={sign(gapCard)}
              className={ok ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}
            />
            <div className="mt-2 pt-2 border-t border-[var(--border)] flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">before tax</span>
              <span
                className={`text-[15px] sm:text-lg font-semibold num tracking-[-0.02em] ${
                  okMarket ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
                } opacity-75`}
              >
                <Amount
                  pkr={Math.abs(gapMarket)}
                  prefix={sign(gapMarket)}
                  compact
                  className="!text-inherit"
                />
              </span>
            </div>
          </Box>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-faint)] num">
          After tax ₨{p.settings.rates.effective}/$ · before tax (market) ₨
          {p.settings.rates.market.toFixed(1)}/$ on dollar costs
        </p>

        {/* bar */}
        <div className="mt-5">
          <div className="h-2.5 rounded-full bg-[var(--surface-3)] overflow-hidden flex">
            <div className="bg-[var(--positive)]" style={{ width: `${paidW}%` }} title="Paid" />
            <div
              className="bg-[var(--accent)]"
              style={{ width: `${leftW}%` }}
              title="Still to pay (after tax)"
            />
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
            {spareW > 0 && (
              <div className="bg-[var(--accent)] opacity-25" style={{ width: `${spareW}%` }} title="Spare" />
            )}
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
              <Amount
                pkr={p.usdShare * p.settings.rates.market}
                usd={p.usdShare}
                displayCurrency="USD"
                compact
              />
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
