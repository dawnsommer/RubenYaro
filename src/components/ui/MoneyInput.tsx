import { useState, useEffect } from "react";
import { Amount } from "./Amount";
import { parseAmount } from "../../lib/parseAmount";
import {
  getConversionContext,
  moneyToPkr,
  moneyToUsd,
} from "../../lib/currency";
import { useStore } from "../../store/useStore";
import { ConversionMode, Currency, Money, TaxRule } from "../../types";

export interface MoneyInputProps {
  value: Money;
  onChange: (next: Money) => void;
  conversionMode?: ConversionMode;
  tax?: TaxRule;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Compact: smaller field, no "≈ converted" hint line (for inline rows). */
  compact?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}

export function MoneyInput({
  value,
  onChange,
  conversionMode,
  tax,
  label,
  placeholder = "0 · e.g. 1.2k, 3 lakh, 450*3",
  id,
  className = "",
  compact = false,
  autoFocus,
  onEnter,
}: MoneyInputProps) {
  const settings = useStore((s) => s.settings);
  const ctx = getConversionContext(settings);
  const [text, setText] = useState<string>(
    value.amount ? String(value.amount) : "",
  );

  useEffect(() => {
    const parsed = parseAmount(text);
    if (parsed !== value.amount) {
      setText(value.amount ? String(value.amount) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setText(parsed ? String(parsed) : "");
      onChange({ amount: parsed, currency: value.currency });
    }
  };

  const toggleCurrency = (curr: Currency) => {
    onChange({ amount: value.amount, currency: curr });
  };

  const modeUsed = conversionMode ?? settings.defaultConversionMode;
  const convertedPkr = moneyToPkr(value, ctx, conversionMode, tax);
  const convertedUsd = moneyToUsd(value, ctx, conversionMode, tax);
  const targetCurrency: Currency = value.currency === "USD" ? "PKR" : "USD";

  const modeLabel =
    modeUsed === "effective"
      ? `at card rate ₨${settings.rates.effective}`
      : modeUsed === "market"
        ? `at market ₨${settings.rates.market}`
        : "with detailed tax";

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[var(--text-muted)] mb-1.5"
        >
          {label}
        </label>
      )}
      <div
        className={`field flex items-center gap-2 ${compact ? "!py-1 !pl-2.5 !pr-1" : "!py-1.5 !pr-1.5"}`}
      >
        {!compact && (
          <span className="text-[var(--text-faint)] text-sm num shrink-0">
            {value.currency === "USD" ? "$" : "₨"}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) {
              handleBlur();
              onEnter();
            }
          }}
          placeholder={compact ? "0" : placeholder}
          className="flex-1 bg-transparent text-sm num text-[var(--text)] outline-none min-w-0 w-full"
        />
        {compact ? (
          <button
            type="button"
            onClick={() =>
              toggleCurrency(value.currency === "USD" ? "PKR" : "USD")
            }
            title="Switch currency"
            className="shrink-0 h-6 px-2 rounded-full bg-[var(--surface-3)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            {value.currency}
          </button>
        ) : (
          <div className="inline-flex rounded-full bg-[var(--surface-3)] p-[2px] text-[11px] font-semibold shrink-0">
            {(["USD", "PKR"] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => toggleCurrency(curr)}
                className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  value.currency === curr
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        )}
      </div>
      {!compact && value.amount > 0 && (
        <div className="mt-1.5 text-xs text-[var(--text-muted)] num">
          ≈{" "}
          <Amount
            pkr={convertedPkr}
            usd={convertedUsd}
            displayCurrency={targetCurrency}
            tone="muted"
          />{" "}
          {modeLabel}
        </div>
      )}
    </div>
  );
}
