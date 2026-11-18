import { describe, it, expect } from 'vitest';
import {
  usdToPkr,
  pkrToUsd,
  moneyToPkr,
  moneyToUsd,
  computeBreakdown,
} from '../currency';
import { fetchLiveMarketRate, isRateCacheFresh } from '../rates';

describe('currency engine (§5)', () => {
  const M = 281.4;
  const E = 300;

  describe('§5.1 USD → PKR', () => {
    it('market mode: pkr = usd * M', () => {
      expect(usdToPkr(1000, 'market', M, E)).toBeCloseTo(281400, 2);
    });

    it('effective mode: pkr = usd * E', () => {
      expect(usdToPkr(1000, 'effective', M, E)).toBe(300000);
    });

    it('detailed mode with percent tax: base + base * p/100', () => {
      const pkr = usdToPkr(1000, 'detailed', M, E, { kind: 'percent', value: 5 });
      // 281,400 + 14,070 = 295,470
      expect(pkr).toBeCloseTo(295470, 2);
    });

    it('detailed mode with fixed PKR tax: base + fixed', () => {
      const pkr = usdToPkr(1000, 'detailed', M, E, { kind: 'fixed', value: 5000 });
      expect(pkr).toBeCloseTo(286400, 2);
    });
  });

  describe('§5.2 PKR → USD (inverse)', () => {
    it('market mode: usd = pkr / M', () => {
      expect(pkrToUsd(281400, 'market', M, E)).toBeCloseTo(1000, 4);
    });

    it('effective mode: usd = pkr / E', () => {
      expect(pkrToUsd(300000, 'effective', M, E)).toBeCloseTo(1000, 4);
    });

    it('detailed mode with percent tax: usd = pkr / (M * (1 + p/100))', () => {
      const usd = pkrToUsd(295470, 'detailed', M, E, { kind: 'percent', value: 5 });
      expect(usd).toBeCloseTo(1000, 4);
    });

    it('detailed mode with fixed PKR tax: usd = max(0, pkr - f) / M', () => {
      const usd = pkrToUsd(286400, 'detailed', M, E, { kind: 'fixed', value: 5000 });
      expect(usd).toBeCloseTo(1000, 4);
      // Clamped at 0 when pkr < fixed tax
      expect(pkrToUsd(3000, 'detailed', M, E, { kind: 'fixed', value: 5000 })).toBe(0);
    });
  });

  describe('§5.3 Breakdown & Money helpers', () => {
    const ctx = {
      market: M,
      effective: E,
      defaultConversionMode: 'detailed' as const,
      defaultTax: { kind: 'percent' as const, value: 5 },
    };

    it('computes breakdown for USD money in detailed mode', () => {
      const b = computeBreakdown({ amount: 1000, currency: 'USD' }, ctx);
      expect(b.usd).toBe(1000);
      expect(b.marketPkr).toBeCloseTo(281400, 2);
      expect(b.tax).toBeCloseTo(14070, 2);
      expect(b.totalPkr).toBeCloseTo(295470, 2);
      expect(b.mode).toBe('detailed');
    });

    it('converts Money with overrides', () => {
      expect(moneyToPkr({ amount: 500, currency: 'USD' }, ctx, 'effective')).toBe(150000);
      expect(moneyToUsd({ amount: 300000, currency: 'PKR' }, ctx, 'effective')).toBe(1000);
    });
  });

  describe('§5.6 Live market rate fetcher (primary -> fallback -> cache -> manual)', () => {
    it('returns cached rate when < 12h old', async () => {
      const freshIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(isRateCacheFresh(freshIso)).toBe(true);

      const res = await fetchLiveMarketRate({
        market: 279.5,
        marketSource: 'auto',
        marketUpdatedAt: freshIso,
        marketProvider: 'open.er-api.com',
        effective: 300,
      });
      expect(res?.fromCache).toBe(true);
      expect(res?.rate).toBe(279.5);
    });

    it('fetches from primary open.er-api.com when stale', async () => {
      const mockFetch = (async (url: string) => {
        if (url.includes('open.er-api.com')) {
          return {
            ok: true,
            json: async () => ({ rates: { PKR: 281.45 } }),
          } as Response;
        }
        throw new Error('not called');
      }) as unknown as typeof fetch;

      const res = await fetchLiveMarketRate(
        {
          market: 280,
          marketSource: 'auto',
          marketUpdatedAt: null,
          marketProvider: null,
          effective: 300,
        },
        { fetchImpl: mockFetch }
      );
      expect(res?.fromCache).toBe(false);
      expect(res?.rate).toBe(281.45);
      expect(res?.provider).toBe('open.er-api.com');
    });

    it('falls back to fawazahmed0 currency-api when primary fails', async () => {
      const mockFetch = (async (url: string) => {
        if (url.includes('open.er-api.com')) {
          throw new Error('network error');
        }
        return {
          ok: true,
          json: async () => ({ usd: { pkr: 282.1 } }),
        } as Response;
      }) as unknown as typeof fetch;

      const res = await fetchLiveMarketRate(
        {
          market: 280,
          marketSource: 'auto',
          marketUpdatedAt: null,
          marketProvider: null,
          effective: 300,
        },
        { fetchImpl: mockFetch }
      );
      expect(res?.fromCache).toBe(false);
      expect(res?.rate).toBe(282.1);
      expect(res?.provider).toBe('fawazahmed0/currency-api');
    });

    it('respects manual source unless forced', async () => {
      const res = await fetchLiveMarketRate({
        market: 285,
        marketSource: 'manual',
        marketUpdatedAt: null,
        marketProvider: 'manual',
        effective: 300,
      });
      expect(res?.fromCache).toBe(true);
      expect(res?.rate).toBe(285);
    });
  });
});
