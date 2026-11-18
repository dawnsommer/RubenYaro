import { describe, it, expect } from 'vitest';
import { parseAmount } from '../parseAmount';

describe('parseAmount (§7.4)', () => {
  it('parses plain numbers and comma-grouped numbers', () => {
    expect(parseAmount('1200')).toBe(1200);
    expect(parseAmount('1,200.50')).toBe(1200.5);
    expect(parseAmount('₨ 300,000')).toBe(300000);
    expect(parseAmount('$950')).toBe(950);
  });

  it('parses k, m, lakh, and crore shorthands', () => {
    expect(parseAmount('1.2k')).toBe(1200);
    expect(parseAmount('3 lakh')).toBe(300000);
    expect(parseAmount('4.5 lac')).toBe(450000);
    expect(parseAmount('2.5m')).toBe(2500000);
    expect(parseAmount('1.5 cr')).toBe(15000000);
  });

  it('parses simple math expressions', () => {
    expect(parseAmount('450*3')).toBe(1350);
    expect(parseAmount('1200 * 5')).toBe(6000);
    expect(parseAmount('300k + 60k')).toBe(360000);
    expect(parseAmount('600000 / 2')).toBe(300000);
    expect(parseAmount('500 - 50')).toBe(450);
  });

  it('returns null on invalid strings', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('100 / 0')).toBeNull();
  });
});
