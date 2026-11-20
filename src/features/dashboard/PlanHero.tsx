import { ReactNode } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { Amount } from '../../components/ui';
import type { Settings } from '../../types';

export interface PlanHeroProps {
  settings: Settings;
  includeMaybes: boolean;
  onToggleMaybes: () => void;
  fundsPkr: number;
  owedPkr: number; // still owed to people I borrowed from
  paidPkr: number;
  planMarketPkr: number;
  planCardPkr: number;
  maybeExtraCardPkr: number; // what the maybes would add (after tax)
  costCount: number;
  usdShare: number; // $ amount of the plan that is priced in USD
}

/** Big number: compact on phones so the two boxes fit side by side. `size` = main row or second row. */
function Big({
  pkr,
  prefix,
  className = '',
  size = 'lg',
}: {
  pkr: number;
  prefix?: string;
  className?: string;
  size?: 'lg' | 'md';
}) {
  const cls =
    size === 'lg'
      ? 'text-[27px] sm:text-[40px] tracking-[-0.04em]'
      : 'text-[19px] sm:text-[25px] tracking-[-0.03em]';
  return (
    <p className={`${cls} leading-none font-semibold num ${className}`}>
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
  quiet,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  tint?: string;
  quiet?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] min-w-0 border border-[var(--border)] ${
        quiet
          ? 'p-3.5 sm:p-4 bg-[var(--surface-2)]/50'
          : 'p-4 sm:p-5 bg-[var(--surface)] shadow-[var(--shadow-sm)]'
      }`}
      style={tint ? { backgroundImage: `linear-gradient(160deg, ${tint}, transparent 70%)` } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-[12px] font-semibold text-[var(--text-muted)] whitespace-nowrap">{title}</p>
        {aside}
      </div>
      <div className={quiet ? 'mt-2' : 'mt-2.5'}>{children}</div>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
      {children}
    </p>
  );
}

function Under({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-2 pt-2 border-t border-[var(--border)] flex flex-wrap items-baseline justify-between gap-x-2">
      <span className="text-[11.5px] text-[var(--text-muted)] whitespace-nowrap">{label}</span>
      <span className="text-[13px] sm:text-[15px] font-semibold num tracking-[-0.02em] text-[var(--text-muted)]">
        {children}
      </span>
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
  // what I'll have once every cost is paid AND every person I borrowed from is repaid
  const netFunds = p.fundsPkr - p.owedPkr;
  const gapCard = netFunds - leftCard;
  const gapMarket = netFunds - leftMarket;
  const ok = gapCard >= 0;
  const okMarket = gapMarket >= 0;
  const paidPct = p.planCardPkr > 0 ? Math.min(100, (p.paidPkr / p.planCardPkr) * 100) : 0;

  // bar: paid | still to pay | spare/short, on the plan's scale
  const scale = Math.max(p.planCardPkr, p.paidPkr + Math.max(0, netFunds), 1);
  const paidW = (p.paidPkr / scale) * 100;
  const leftW = (Math.min(leftCard, Math.max(0, netFunds)) / scale) * 100;
  const shortW = ok ? 0 : ((leftCard - Math.max(0, netFunds)) / scale) * 100;
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
                {p.owedPkr > 0.5 ? ' · after repaying loans' : ''}
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

        {/* 1 · the two numbers that matter most */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          <Box
            title="Left to pay"
            aside={
              <span className="max-sm:hidden text-[11px] num text-[var(--text-faint)] whitespace-nowrap">
                {p.costCount} costs
              </span>
            }
          >
            <Tag>After tax</Tag>
            <Big pkr={leftCard} />
            <Under label="before tax">
              <Amount pkr={leftMarket} compact className="!text-inherit" />
            </Under>
          </Box>
          <Box title="Paid so far" tint="var(--positive-soft)">
            <Tag>
              <span className="text-[var(--positive)]">{Math.round(paidPct)}% done</span>
            </Tag>
            <Big pkr={p.paidPkr} className={p.paidPkr > 0 ? 'text-[var(--positive)]' : ''} />
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <div className="h-full bg-[var(--positive)] rounded-full" style={{ width: `${paidPct}%` }} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-[var(--text-muted)] num">
                of <Amount pkr={p.planCardPkr} compact tone="muted" /> after tax
              </p>
            </div>
          </Box>
        </div>

        {/* 2 · smaller, still prominent */}
        <div className="mt-2.5 sm:mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
          <Box quiet title="Total after tax">
            <Big size="md" pkr={p.planCardPkr} />
            <p className="mt-1.5 text-[11.5px] text-[var(--text-muted)] num">
              before tax <Amount pkr={p.planMarketPkr} compact tone="muted" />
            </p>
          </Box>
          <Box
            quiet
            title={
              <>
                <span className="sm:hidden">Spare after all</span>
                <span className="max-sm:hidden">Spare after everything</span>
              </>
            }
            tint={ok ? 'var(--positive-soft)' : 'var(--negative-soft)'}
          >
            <Big
              size="md"
              pkr={Math.abs(gapCard)}
              prefix={sign(gapCard)}
              className={ok ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}
            />
            <p className="mt-1.5 text-[11.5px] text-[var(--text-muted)] num">
              before tax{' '}
              <span className={okMarket ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}>
                <Amount
                  pkr={Math.abs(gapMarket)}
                  prefix={sign(gapMarket)}
                  compact
                  className="!text-inherit"
                />
              </span>
            </p>
          </Box>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-faint)] num">
          After tax ₨{p.settings.rates.effective}/$ · before tax (market) ₨
          {p.settings.rates.market.toFixed(1)}/$ on dollar costs
        </p>

        {/* bar */}
        <div className="mt-4">
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

        {/* 3 · details: small, but everything is here */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Detail label="My money">
            <Amount pkr={p.fundsPkr} />
          </Detail>
          {p.owedPkr > 0.5 && (
            <Detail label="I owe people">
              <Amount pkr={p.owedPkr} tone="negative" />
            </Detail>
          )}
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
