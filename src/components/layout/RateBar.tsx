import { useState } from 'react';
import { Eye, EyeOff, SunMoon, RefreshCw, Command } from 'lucide-react';
import { Segmented } from '../ui/Segmented';
import { Popover } from '../ui/Popover';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';

export interface RateBarProps {
  marketRate?: number;
  effectiveRate?: number;
  taxPercent?: number;
  displayCurrency: 'PKR' | 'USD';
  onDisplayCurrencyChange: (c: 'PKR' | 'USD') => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  onToggleTheme: () => void;
  onMarketRateChange?: (rate: number) => void;
  onEffectiveRateChange?: (rate: number) => void;
  onTaxPercentChange?: (pct: number) => void;
  onOpenCommandPalette?: () => void;
}

export function RateBar({
  marketRate = 281.4,
  effectiveRate = 300,
  taxPercent = 5,
  displayCurrency,
  onDisplayCurrencyChange,
  privacyMode,
  onTogglePrivacy,
  onToggleTheme,
  onMarketRateChange,
  onEffectiveRateChange,
  onTaxPercentChange,
  onOpenCommandPalette,
}: RateBarProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [draftMarket, setDraftMarket] = useState(String(marketRate));
  const [draftEffective, setDraftEffective] = useState(String(effectiveRate));
  const [draftTax, setDraftTax] = useState(String(taxPercent));

  return (
    <>
      <header
        className="sticky top-0 z-20 h-11 flex items-center gap-2 px-4 lg:px-8 border-b border-[var(--border)] text-[13px] backdrop-blur-md"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
      >
        {/* Mobile condensed trigger */}
        <button
          type="button"
          onClick={() => {
            setDraftMarket(String(marketRate));
            setDraftEffective(String(effectiveRate));
            setDraftTax(String(taxPercent));
            setMobileSheetOpen(true);
          }}
          className="sm:hidden inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" />
          <span>
            ₨{marketRate.toFixed(1)} · ₨{effectiveRate}
          </span>
        </button>

        {/* Desktop chips with popovers */}
        <div className="hidden sm:flex items-center gap-2">
          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={() => {
                  setDraftMarket(String(marketRate));
                  toggle();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--positive)]" />
                <span>Live · 1 USD = ₨ {marketRate.toFixed(2)} · 2h ago</span>
                <RefreshCw className="w-3 h-3 text-[var(--text-muted)]" />
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftMarket);
                  if (val > 0) onMarketRateChange?.(val);
                  close();
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  Market rate (PKR per 1 USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={draftMarket}
                  onChange={(e) => setDraftMarket(e.target.value)}
                  className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            )}
          </Popover>

          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={() => {
                  setDraftEffective(String(effectiveRate));
                  toggle();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer"
              >
                Card rate ₨ {effectiveRate}
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftEffective);
                  if (val > 0) onEffectiveRateChange?.(val);
                  close();
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  After-tax card rate (PKR / USD)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={draftEffective}
                  onChange={(e) => setDraftEffective(e.target.value)}
                  className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            )}
          </Popover>

          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={() => {
                  setDraftTax(String(taxPercent));
                  toggle();
                }}
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer"
              >
                Tax {taxPercent}%
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftTax);
                  if (val >= 0) onTaxPercentChange?.(val);
                  close();
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  Default tax (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={draftTax}
                  onChange={(e) => setDraftTax(e.target.value)}
                  className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            )}
          </Popover>
        </div>

        <div className="flex-1" />

        <Segmented
          ariaLabel="Display currency"
          options={[
            { value: 'PKR', label: 'PKR' },
            { value: 'USD', label: 'USD' },
          ]}
          value={displayCurrency}
          onChange={onDisplayCurrencyChange}
        />

        <button
          type="button"
          onClick={onTogglePrivacy}
          aria-label="Toggle privacy mode"
          title="Toggle privacy blur (p)"
          className={`inline-flex items-center justify-center rounded-full border border-[var(--border)] w-7 h-7 text-xs cursor-pointer ${
            privacyMode
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {privacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title="Toggle dark/light theme"
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] w-7 h-7 text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <SunMoon className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Command palette"
          className="hidden md:inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <Command className="w-3 h-3" />K
        </button>
      </header>

      <Sheet
        open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        title="Exchange rates & tax"
        footer={
          <Button
            onClick={() => {
              const m = parseFloat(draftMarket);
              const ef = parseFloat(draftEffective);
              const tx = parseFloat(draftTax);
              if (m > 0) onMarketRateChange?.(m);
              if (ef > 0) onEffectiveRateChange?.(ef);
              if (tx >= 0) onTaxPercentChange?.(tx);
              setMobileSheetOpen(false);
            }}
          >
            Save changes
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Market rate (PKR per 1 USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={draftMarket}
              onChange={(e) => setDraftMarket(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Card / effective rate (PKR per 1 USD)
            </label>
            <input
              type="number"
              step="1"
              value={draftEffective}
              onChange={(e) => setDraftEffective(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Default tax (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={draftTax}
              onChange={(e) => setDraftTax(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
