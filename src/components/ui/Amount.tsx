import { HTMLAttributes, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  Breakdown,
  computeBreakdown,
  formatBreakdownTooltip,
  getConversionContext,
  pkrToUsd,
} from '../../lib/currency';
import { formatCurrency } from '../../lib/format';
import { Currency } from '../../types';

export type AmountTone = 'default' | 'positive' | 'negative' | 'warning' | 'muted';

export interface AmountProps extends HTMLAttributes<HTMLSpanElement> {
  pkr: number;
  usd?: number;
  /** Optional after-tax (×300 card rate) PKR amount to show in a smaller muted line */
  afterTaxPkr?: number;
  displayCurrency?: Currency;
  showSecondary?: boolean;
  compact?: boolean;
  tone?: AmountTone;
  breakdown?: Breakdown;
  breakdownTooltip?: string;
  privacyBlur?: boolean;
  prefix?: string;
  /** PKR-only display in a fixed unit (Inheritance page): lac = 100,000 · million = 1,000,000 */
  pkrUnit?: 'pkr' | 'lac' | 'million';
}

export function formatPkrUnit(pkr: number, unit: 'pkr' | 'lac' | 'million', digits = 2): string {
  if (unit === 'pkr') return formatCurrency(pkr, 'PKR');
  const v = pkr / (unit === 'lac' ? 100_000 : 1_000_000);
  const n = Number(v.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
  return unit === 'lac' ? `${n} lac` : `${n}M`;
}

export function Amount({
  pkr,
  usd,
  afterTaxPkr,
  displayCurrency: displayCurrencyProp,
  showSecondary = false,
  compact = false,
  tone = 'default',
  breakdown,
  breakdownTooltip,
  privacyBlur,
  prefix = '',
  pkrUnit,
  className = '',
  ...props
}: AmountProps) {
  const settings = useStore((s) => s.settings);
  const [revealed, setRevealed] = useState(false);

  const displayCurrency = displayCurrencyProp ?? settings.displayCurrency;
  const isPrivacy = privacyBlur ?? settings.privacyMode;
  const ctx = getConversionContext(settings);

  const computedUsd =
    usd ??
    pkrToUsd(
      pkr,
      'market',
      settings.rates.market,
      settings.rates.effective,
      settings.defaultTax
    );

  const primaryValue = displayCurrency === 'PKR' ? pkr : computedUsd;
  const secondaryCurrency: Currency = displayCurrency === 'PKR' ? 'USD' : 'PKR';
  const secondaryValue = displayCurrency === 'PKR' ? computedUsd : pkr;

  const autoBreakdown =
    breakdown ??
    computeBreakdown(
      usd !== undefined ? { amount: usd, currency: 'USD' } : { amount: pkr, currency: 'PKR' },
      ctx
    );

  const tooltip = pkrUnit
    ? formatCurrency(pkr, 'PKR')
    : breakdownTooltip ?? formatBreakdownTooltip(autoBreakdown);

  const toneClass: Record<AmountTone, string> = {
    default: 'text-[var(--text)]',
    positive: 'text-[var(--positive)]',
    negative: 'text-[var(--negative)]',
    warning: 'text-[var(--warning)]',
    muted: 'text-[var(--text-muted)]',
  };

  const showAfterTax =
    typeof afterTaxPkr === 'number' && Math.round(afterTaxPkr) !== Math.round(pkr);

  return (
    <span
      title={tooltip}
      onMouseEnter={() => isPrivacy && setRevealed(true)}
      onMouseLeave={() => isPrivacy && setRevealed(false)}
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 num transition-opacity duration-150 ${
        isPrivacy && !revealed ? 'amt blur-[6px] select-none' : ''
      } ${toneClass[tone]} ${className}`}
      {...props}
    >
      <span className="whitespace-nowrap">
        {prefix}
        {pkrUnit
          ? formatPkrUnit(pkr, pkrUnit)
          : formatCurrency(primaryValue, displayCurrency, { compact })}
      </span>
      {showSecondary && (
        <span className="text-xs font-normal text-[var(--text-muted)]">
          ≈ {formatCurrency(secondaryValue, secondaryCurrency, { compact })}
        </span>
      )}
      {showAfterTax && (
        <span className="text-[11px] font-normal text-[var(--text-muted)]">
          (×{settings.rates.effective}:{' '}
          {formatCurrency(afterTaxPkr, 'PKR', { compact })})
        </span>
      )}
    </span>
  );
}
