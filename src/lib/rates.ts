import { Settings } from '../types';

export const PRIMARY_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
export const FALLBACK_RATE_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

export const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface RateFetchResult {
  rate: number;
  provider: string;
  updatedAt: string;
  fromCache: boolean;
}

export function isRateCacheFresh(updatedAt: string | null, nowMs = Date.now()): boolean {
  if (!updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts < CACHE_TTL_MS;
}

export async function fetchLiveMarketRate(
  currentRates: Settings['rates'],
  options: { force?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<RateFetchResult | null> {
  const { force = false, fetchImpl = globalThis.fetch } = options;

  // Manual override pauses auto-refresh unless explicitly forced
  if (currentRates.marketSource === 'manual' && !force) {
    return {
      rate: currentRates.market,
      provider: currentRates.marketProvider ?? 'manual',
      updatedAt: currentRates.marketUpdatedAt ?? new Date().toISOString(),
      fromCache: true,
    };
  }

  if (!force && isRateCacheFresh(currentRates.marketUpdatedAt)) {
    return {
      rate: currentRates.market,
      provider: currentRates.marketProvider ?? 'cache',
      updatedAt: currentRates.marketUpdatedAt!,
      fromCache: true,
    };
  }

  if (typeof fetchImpl !== 'function') {
    return null;
  }

  // 1. Primary: open.er-api.com
  try {
    const res = await fetchImpl(PRIMARY_RATE_URL);
    if (res.ok) {
      const data = (await res.json()) as { rates?: { PKR?: number } };
      const pkr = data?.rates?.PKR;
      if (typeof pkr === 'number' && pkr > 0) {
        return {
          rate: Math.round(pkr * 100) / 100,
          provider: 'open.er-api.com',
          updatedAt: new Date().toISOString(),
          fromCache: false,
        };
      }
    }
  } catch {
    // Fall through to fallback
  }

  // 2. Fallback: fawazahmed0 currency-api via jsdelivr
  try {
    const res = await fetchImpl(FALLBACK_RATE_URL);
    if (res.ok) {
      const data = (await res.json()) as { usd?: { pkr?: number } };
      const pkr = data?.usd?.pkr;
      if (typeof pkr === 'number' && pkr > 0) {
        return {
          rate: Math.round(pkr * 100) / 100,
          provider: 'fawazahmed0/currency-api',
          updatedAt: new Date().toISOString(),
          fromCache: false,
        };
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

export function formatRelativeRateAge(updatedAt: string | null, nowMs = Date.now()): string {
  if (!updatedAt) return 'not synced';
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return 'not synced';
  const diffMin = Math.max(0, Math.floor((nowMs - ts) / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
