import { Currency } from '../types';

export type GroupingStyle = 'international' | 'lakh';

export function formatCurrency(
  amount: number,
  currency: Currency,
  options: { compact?: boolean; grouping?: GroupingStyle } = {}
): string {
  const { compact = false, grouping = 'international' } = options;
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const symbol = currency === 'PKR' ? '₨ ' : '$';

  if (compact) {
    if (currency === 'PKR') {
      if (abs >= 1_000_000) {
        const m = abs / 1_000_000;
        const formatted = Number(m.toFixed(m >= 10 ? 1 : 2));
        return `${sign}₨ ${formatted}M`;
      }
      if (abs >= 1_000) {
        const k = abs / 1_000;
        const formatted = Number(k.toFixed(k >= 100 ? 0 : 1));
        return `${sign}₨ ${formatted}k`;
      }
      return `${sign}₨ ${Math.round(abs)}`;
    } else {
      if (abs >= 1_000_000) {
        const m = abs / 1_000_000;
        return `${sign}$${Number(m.toFixed(2))}M`;
      }
      if (abs >= 1_000) {
        const k = abs / 1_000;
        return `${sign}$${Number(k.toFixed(1))}k`;
      }
      return `${sign}$${Number(abs.toFixed(2))}`;
    }
  }

  const locale = grouping === 'lakh' && currency === 'PKR' ? 'en-IN' : 'en-US';
  if (currency === 'PKR') {
    const rounded = Math.round(abs);
    const numStr = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(rounded);
    return `${sign}${symbol}${numStr}`;
  } else {
    const rounded = Math.round(abs * 100) / 100;
    const hasDecimals = Math.abs(rounded - Math.round(rounded)) > 0.001;
    const numStr = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(rounded);
    return `${sign}$${numStr}`;
  }
}
