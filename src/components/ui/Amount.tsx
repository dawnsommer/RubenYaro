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
  displayCurrency?: Currency;
  showSecondary?: boolean;
  compact?: boolean;
  tone?: AmountTone;
  breakdown?: Breakdown;
  breakdownTooltip?: string;
  privacyBlur?: boolean;
  prefix?: string;
}

export function Amount({
  pkr,
  usd,
  displayCurrency: displayCurrencyProp,
  showSecondary = false,
  compact = false,
  tone = 'default',
  breakdown,
  breakdownTooltip,
  privacyBlur,
  prefix = '',
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
      settings.defaultConversionMode,
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

  const tooltip = breakdownTooltip ?? formatBreakdownTooltip(autoBreakdown);

  const toneClass: Record<AmountTone, string> = {
    default: 'text-[var(--text)]',
    positive: 'text-[var(--positive)]',
    negative: 'text-[var(--negative)]',
    warning: 'text-[var(--warning)]',
    muted: 'text-[var(--text-muted)]',
  };

  return (
    <span
      title={tooltip}
      onMouseEnter={() => isPrivacy && setRevealed(true)}
      onMouseLeave={() => isPrivacy && setRevealed(false)}
      className={`inline-flex items-baseline gap-1.5 num transition-opacity duration-150 ${
        isPrivacy && !revealed ? 'amt blur-[6px] select-none' : ''
      } ${toneClass[tone]} ${className}`}
      {...props}
    >
      <span>
        {prefix}
        {formatCurrency(primaryValue, displayCurrency, { compact })}
      </span>
      {showSecondary && (
        <span className="text-xs font-normal text-[var(--text-muted)]">
          ≈ {formatCurrency(secondaryValue, secondaryCurrency, { compact })}
        </span>
      )}
    </span>
  );
}
