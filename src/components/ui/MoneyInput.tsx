import { useState, useEffect } from 'react';
import { Amount } from './Amount';

export interface MoneyValue {
  amount: number;
  currency: 'USD' | 'PKR';
}

export interface MoneyInputProps {
  value: MoneyValue;
  onChange: (next: MoneyValue) => void;
  effectiveRate?: number;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}

function quickParse(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/,/g, '');
  if (!cleaned) return 0;
  const lakhMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(?:lakh|lac|l)$/);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100_000;
  const kMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;
  const mMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(?:m|mn)$/);
  if (mMatch) return parseFloat(mMatch[1]) * 1_000_000;
  const mulMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\*\s*(-?\d+(?:\.\d+)?)$/);
  if (mulMatch) return parseFloat(mulMatch[1]) * parseFloat(mulMatch[2]);
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function MoneyInput({
  value,
  onChange,
  effectiveRate = 300,
  label,
  placeholder = '0',
  id,
  className = '',
}: MoneyInputProps) {
  const [text, setText] = useState<string>(value.amount ? String(value.amount) : '');

  useEffect(() => {
    const parsed = quickParse(text);
    if (parsed !== value.amount) {
      setText(value.amount ? String(value.amount) : '');
    }
  }, [value.amount]);

  const handleTextChange = (nextRaw: string) => {
    setText(nextRaw);
    const parsed = quickParse(nextRaw);
    if (parsed !== null && parsed >= 0) {
      onChange({ amount: parsed, currency: value.currency });
    }
  };

  const toggleCurrency = (curr: 'USD' | 'PKR') => {
    onChange({ amount: value.amount, currency: curr });
  };

  const convertedPkr =
    value.currency === 'PKR' ? value.amount : value.amount * effectiveRate;
  const convertedUsd =
    value.currency === 'USD' ? value.amount : value.amount / effectiveRate;

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
          displayCurrency={value.currency === 'USD' ? 'PKR' : 'USD'}
          tone="muted"
        />{' '}
        at card rate
      </div>
    </div>
  );
}
