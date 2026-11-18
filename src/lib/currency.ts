import { ConversionMode, Money, Settings, TaxRule } from '../types';

export interface Breakdown {
  usd: number;
  marketPkr: number;
  tax: number;
  totalPkr: number;
  mode: ConversionMode;
  rateUsed: number;
}

export interface ConversionContext {
  market: number;
  effective: number;
  defaultConversionMode: ConversionMode;
  defaultTax: TaxRule;
}

export function getConversionContext(settings: Settings): ConversionContext {
  return {
    market: settings.rates.market,
    effective: settings.rates.effective,
    defaultConversionMode: settings.defaultConversionMode,
    defaultTax: settings.defaultTax,
  };
}

/**
 * §5.1 USD → PKR
 * - market:    pkr = usd × M
 * - effective: pkr = usd × E
 * - detailed:  base = usd × M; tax = t.kind==='percent' ? base × t.value/100 : t.value; pkr = base + tax
 */
export function usdToPkr(
  usd: number,
  mode: ConversionMode,
  marketRate: number,
  effectiveRate: number,
  taxRule: TaxRule = { kind: 'percent', value: 0 }
): number {
  if (usd === 0) return 0;
  switch (mode) {
    case 'market':
      return usd * marketRate;
    case 'effective':
      return usd * effectiveRate;
    case 'detailed': {
      const base = usd * marketRate;
      const tax = taxRule.kind === 'percent' ? base * (taxRule.value / 100) : taxRule.value;
      return base + tax;
    }
  }
}

/**
 * §5.2 PKR → USD (inverse, used when an amount is entered in PKR)
 * - market:    usd = pkr / M
 * - effective: usd = pkr / E
 * - detailed:  percent: usd = pkr / (M × (1 + p/100))
 *              fixed:   usd = max(0, pkr − f) / M
 */
export function pkrToUsd(
  pkr: number,
  mode: ConversionMode,
  marketRate: number,
  effectiveRate: number,
  taxRule: TaxRule = { kind: 'percent', value: 0 }
): number {
  if (pkr === 0) return 0;
  const safeM = marketRate > 0 ? marketRate : 280;
  const safeE = effectiveRate > 0 ? effectiveRate : 300;
  switch (mode) {
    case 'market':
      return pkr / safeM;
    case 'effective':
      return pkr / safeE;
    case 'detailed': {
      if (taxRule.kind === 'percent') {
        const factor = safeM * (1 + taxRule.value / 100);
        return factor > 0 ? pkr / factor : 0;
      } else {
        return Math.max(0, pkr - taxRule.value) / safeM;
      }
    }
  }
}

/**
 * Converts a stored `Money` ({ amount, currency }) into PKR using the item's mode/tax override or settings default.
 */
export function moneyToPkr(
  money: Money,
  ctx: ConversionContext,
  overrideMode?: ConversionMode,
  overrideTax?: TaxRule
): number {
  if (money.currency === 'PKR') return money.amount;
  const mode = overrideMode ?? ctx.defaultConversionMode;
  const tax = overrideTax ?? ctx.defaultTax;
  return usdToPkr(money.amount, mode, ctx.market, ctx.effective, tax);
}

/**
 * Converts a stored `Money` ({ amount, currency }) into USD using the item's mode/tax override or settings default.
 */
export function moneyToUsd(
  money: Money,
  ctx: ConversionContext,
  overrideMode?: ConversionMode,
  overrideTax?: TaxRule
): number {
  if (money.currency === 'USD') return money.amount;
  const mode = overrideMode ?? ctx.defaultConversionMode;
  const tax = overrideTax ?? ctx.defaultTax;
  return pkrToUsd(money.amount, mode, ctx.market, ctx.effective, tax);
}

/**
 * §5.3 Breakdown object (shown in tooltips & cost detail)
 */
export function computeBreakdown(
  money: Money,
  ctx: ConversionContext,
  overrideMode?: ConversionMode,
  overrideTax?: TaxRule
): Breakdown {
  const mode = overrideMode ?? ctx.defaultConversionMode;
  const taxRule = overrideTax ?? ctx.defaultTax;
  const M = ctx.market > 0 ? ctx.market : 280;
  const E = ctx.effective > 0 ? ctx.effective : 300;

  if (money.currency === 'USD') {
    const usd = money.amount;
    const marketPkr = usd * M;
    const totalPkr = usdToPkr(usd, mode, M, E, taxRule);
    const tax = mode === 'market' ? 0 : totalPkr - marketPkr;
    const rateUsed = usd > 0 ? totalPkr / usd : mode === 'effective' ? E : M;
    return { usd, marketPkr, tax, totalPkr, mode, rateUsed };
  } else {
    const totalPkr = money.amount;
    const usd = pkrToUsd(totalPkr, mode, M, E, taxRule);
    const marketPkr = usd * M;
    const tax = mode === 'market' ? 0 : totalPkr - marketPkr;
    const rateUsed = usd > 0 ? totalPkr / usd : mode === 'effective' ? E : M;
    return { usd, marketPkr, tax, totalPkr, mode, rateUsed };
  }
}

export function formatBreakdownTooltip(b: Breakdown): string {
  const usdStr = `$${b.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const mktStr = `₨ ${Math.round(b.marketPkr).toLocaleString('en-US')}`;
  const totStr = `₨ ${Math.round(b.totalPkr).toLocaleString('en-US')}`;
  if (b.mode === 'market') {
    return `${usdStr} → ${totStr} (market @ ₨${b.rateUsed.toFixed(2)})`;
  }
  if (b.mode === 'effective') {
    return `${usdStr} → ${totStr} (card rate @ ₨${b.rateUsed.toFixed(0)})`;
  }
  const taxStr = `₨ ${Math.round(b.tax).toLocaleString('en-US')}`;
  return `${usdStr} → ${mktStr} + tax ${taxStr} = ${totStr}`;
}
