import { HTMLAttributes } from 'react';

export type AmountTone = 'default' | 'positive' | 'negative' | 'warning' | 'muted';

export interface AmountProps extends HTMLAttributes<HTMLSpanElement> {
  pkr: number;
  usd?: number;
  displayCurrency?: 'PKR' | 'USD';
  showSecondary?: boolean;
  compact?: boolean;
  tone?: AmountTone;
  breakdownTooltip?: string;
  privacyBlur?: boolean;
}

function formatNum(value: number, currency: 'PKR' | 'USD', compact = false): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const symbol = currency === 'PKR' ? '₨ ' : '$ ';

  if (compact) {
    if (currency === 'PKR') {
      if (abs >= 1_000_000) {
        const m = abs / 1_000_000;
        return `${sign}${symbol}${Number(m.toFixed(2))}M`;
      }
      if (abs >= 1_000) {
        const k = abs / 1_000;
        return `${sign}${symbol}${Number(k.toFixed(1))}k`;
      }
    } else {
      if (abs >= 1_000_000) {
        return `${sign}${symbol}${Number((abs / 1_000_000).toFixed(2))}M`;
      }
      if (abs >= 10_000) {
        return `${sign}${symbol}${Number((abs / 1_000).toFixed(1))}k`;
      }
    }
  }

  const rounded = currency === 'PKR' ? Math.round(abs) : Math.round(abs * 100) / 100;
  return `${sign}${symbol}${rounded.toLocaleString('en-US', {
    maximumFractionDigits: currency === 'PKR' ? 0 : 2,
  })}`;
}

export function Amount({
  pkr,
  usd,
  displayCurrency = 'PKR',
  showSecondary = false,
  compact = false,
  tone = 'default',
  breakdownTooltip,
  privacyBlur = false,
  className = '',
  ...props
}: AmountProps) {
  const computedUsd = usd ?? pkr / 300;
  const primaryValue = displayCurrency === 'PKR' ? pkr : computedUsd;
  const secondaryCurrency = displayCurrency === 'PKR' ? 'USD' : 'PKR';
  const secondaryValue = displayCurrency === 'PKR' ? computedUsd : pkr;

  const toneClass: Record<AmountTone, string> = {
    default: 'text-[var(--text)]',
    positive: 'text-[var(--positive)]',
    negative: 'text-[var(--negative)]',
    warning: 'text-[var(--warning)]',
    muted: 'text-[var(--text-muted)]',
  };

  return (
    <span
      title={breakdownTooltip}
      className={`inline-flex items-baseline gap-1.5 num amt ${
        privacyBlur ? 'blur-[6px] select-none' : ''
      } ${toneClass[tone]} ${className}`}
      {...props}
    >
      <span>{formatNum(primaryValue, displayCurrency, compact)}</span>
      {showSecondary && (
        <span className="text-xs font-normal text-[var(--text-muted)]">
          ≈ {formatNum(secondaryValue, secondaryCurrency, compact)}
        </span>
      )}
    </span>
  );
}
