import { useState, useEffect } from 'react';
import { Amount } from './Amount';
import { parseAmount } from '../../lib/parseAmount';
import { getConversionContext, moneyToPkr, moneyToUsd } from '../../lib/currency';
import { useStore } from '../../store/useStore';
import { ConversionMode, Currency, Money, TaxRule } from '../../types';

export interface MoneyInputProps {
  value: Money;
  onChange: (next: Money) => void;
  conversionMode?: ConversionMode;
  tax?: TaxRule;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function MoneyInput({
  value,
  onChange,
  conversionMode,
  tax,
  label,
  placeholder = '0 (e.g. 1.2k, 3 lakh, 450*3)',
  id,
  className = '',
}: MoneyInputProps) {
  const settings = useStore((s) => s.settings);
  const ctx = getConversionContext(settings);
  const [text, setText] = useState<string>(value.amount ? String(value.amount) : '');

  useEffect(() => {
    const parsed = parseAmount(text);
    if (parsed !== value.amount) {
      setText(value.amount ? String(value.amount) : '');
    }
  }, [value.amount]);

  const handleTextChange = (nextRaw: string) => {
    setText(nextRaw);
    if (!nextRaw.trim()) {
      onChange({ amount: 0, currency: value.currency });
      return;
    }
    const parsed = parseAmount(nextRaw);
    if (parsed !== null && parsed >= 0) {
      onChange({ amount: parsed, currency: value.currency });
    }
  };

  const handleBlur = () => {
    const parsed = parseAmount(text);
    if (parsed !== null && parsed >= 0) {
      setText(parsed ? String(parsed) : '');
      onChange({ amount: parsed, currency: value.currency });
    }
  };

  const toggleCurrency = (curr: Currency) => {
    onChange({ amount: value.amount, currency: curr });
  };

  const modeUsed = conversionMode ?? settings.defaultConversionMode;
  const convertedPkr = moneyToPkr(value, ctx, conversionMode, tax);
  const convertedUsd = moneyToUsd(value, ctx, conversionMode, tax);
  const targetCurrency: Currency = value.currency === 'USD' ? 'PKR' : 'USD';

  const modeLabel =
    modeUsed === 'effective'
      ? `at card rate ₨${settings.rates.effective}`
      : modeUsed === 'market'
        ? `at market ₨${settings.rates.market}`
        : 'with detailed tax';

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[var(--text-muted)] mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 focus-within:border-[var(--accent)]">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm num text-[var(--text)] outline-none min-w-0"
        />
        <div className="inline-flex rounded-full bg-[var(--surface)] p-0.5 border border-[var(--border)] text-xs font-medium">
          {(['USD', 'PKR'] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => toggleCurrency(curr)}
              className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                value.currency === curr
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 text-xs text-[var(--text-muted)] num">
        ≈{' '}
        <Amount
          pkr={convertedPkr}
          usd={convertedUsd}
          displayCurrency={targetCurrency}
          tone="muted"
        />{' '}
        {modeLabel}
      </div>
    </div>
  );
}
