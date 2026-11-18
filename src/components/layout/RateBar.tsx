import { useEffect, useState } from 'react';
import { Eye, EyeOff, SunMoon, RefreshCw, Command } from 'lucide-react';
import { Segmented } from '../ui/Segmented';
import { Popover } from '../ui/Popover';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { fetchLiveMarketRate, formatRelativeRateAge } from '../../lib/rates';

export interface RateBarProps {
  onOpenCommandPalette?: () => void;
}

export function RateBar({ onOpenCommandPalette }: RateBarProps) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateRates = useStore((s) => s.updateRates);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);

  const [draftMarket, setDraftMarket] = useState(String(settings.rates.market));
  const [draftEffective, setDraftEffective] = useState(String(settings.rates.effective));
  const [draftTax, setDraftTax] = useState(String(settings.defaultTax.value));

  const runLiveRateFetch = async (force = false) => {
    setRefreshing(true);
    const res = await fetchLiveMarketRate(useStore.getState().settings.rates, { force });
    setRefreshing(false);
    if (res) {
      setOfflineFailed(false);
      if (!res.fromCache || force) {
        updateRates({
          market: res.rate,
          marketProvider: res.provider,
          marketUpdatedAt: res.updatedAt,
          marketSource: 'auto',
        });
      }
    } else {
      setOfflineFailed(true);
    }
  };

  useEffect(() => {
    if (settings.rates.marketSource === 'auto') {
      void runLiveRateFetch(false);
    }
  }, []);

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    updateSettings({ theme: isDark ? 'dark' : 'light' });
  };

  const ageLabel = formatRelativeRateAge(settings.rates.marketUpdatedAt);
  const isManual = settings.rates.marketSource === 'manual';

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
            setDraftMarket(String(settings.rates.market));
            setDraftEffective(String(settings.rates.effective));
            setDraftTax(String(settings.defaultTax.value));
            setMobileSheetOpen(true);
          }}
          className="sm:hidden inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              offlineFailed
                ? 'bg-[var(--warning)]'
                : isManual
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--positive)]'
            }`}
          />
          <span>
            ₨{settings.rates.market.toFixed(1)} · ₨{settings.rates.effective}
          </span>
        </button>

        {/* Desktop chips with popovers */}
        <div className="hidden sm:flex items-center gap-2">
          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={() => {
                  setDraftMarket(String(settings.rates.market));
                  toggle();
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer ${
                  offlineFailed
                    ? 'border-[var(--warning)] text-[var(--warning)]'
                    : 'border-[var(--border)] text-[var(--text)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    offlineFailed
                      ? 'bg-[var(--warning)]'
                      : isManual
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--positive)]'
                  }`}
                />
                <span>
                  {offlineFailed
                    ? `Offline · ₨ ${settings.rates.market.toFixed(2)} · ${ageLabel}`
                    : isManual
                      ? `Manual · 1 USD = ₨ ${settings.rates.market.toFixed(2)}`
                      : `Live · 1 USD = ₨ ${settings.rates.market.toFixed(2)} · ${ageLabel}`}
                </span>
                <RefreshCw
                  className={`w-3 h-3 text-[var(--text-muted)] ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftMarket);
                  if (val > 0) {
                    updateRates({
                      market: val,
                      marketSource: 'manual',
                      marketUpdatedAt: new Date().toISOString(),
                    });
                  }
                  close();
                }}
                className="space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Market rate (PKR / 1 USD)
                  </label>
                  {isManual && (
                    <button
                      type="button"
                      onClick={() => {
                        updateRates({ marketSource: 'auto' });
                        void runLiveRateFetch(true);
                        close();
                      }}
                      className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      Use live rate
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={draftMarket}
                  onChange={(e) => setDraftMarket(e.target.value)}
                  className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm num outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void runLiveRateFetch(true);
                      close();
                    }}
                  >
                    Refresh live
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={close}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Save manual
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </Popover>

          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={() => {
                  setDraftEffective(String(settings.rates.effective));
                  toggle();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer"
              >
                Card rate ₨ {settings.rates.effective}
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftEffective);
                  if (val > 0) updateRates({ effective: val });
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
                  setDraftTax(String(settings.defaultTax.value));
                  toggle();
                }}
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium num hover:bg-[var(--surface-2)] cursor-pointer"
              >
                Tax{' '}
                {settings.defaultTax.kind === 'percent'
                  ? `${settings.defaultTax.value}%`
                  : `₨ ${settings.defaultTax.value}`}
              </button>
            )}
          >
            {({ close }) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(draftTax);
                  if (val >= 0) {
                    updateSettings({
                      defaultTax: { ...settings.defaultTax, value: val },
                    });
                  }
                  close();
                }}
                className="space-y-2"
              >
                <label className="block text-xs font-medium text-[var(--text-muted)]">
                  Default tax ({settings.defaultTax.kind === 'percent' ? '%' : 'PKR'})
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
          value={settings.displayCurrency}
          onChange={(c) => updateSettings({ displayCurrency: c })}
        />

        <button
          type="button"
          onClick={() => updateSettings({ privacyMode: !settings.privacyMode })}
          aria-label="Toggle privacy mode"
          title="Toggle privacy blur (p)"
          className={`inline-flex items-center justify-center rounded-full border border-[var(--border)] w-7 h-7 text-xs cursor-pointer ${
            settings.privacyMode
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {settings.privacyMode ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleTheme}
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
              if (m > 0 && m !== settings.rates.market) {
                updateRates({
                  market: m,
                  marketSource: 'manual',
                  marketUpdatedAt: new Date().toISOString(),
                });
              }
              if (ef > 0) updateRates({ effective: ef });
              if (tx >= 0) {
                updateSettings({
                  defaultTax: { ...settings.defaultTax, value: tx },
                });
              }
              setMobileSheetOpen(false);
            }}
          >
            Save changes
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Market rate (PKR per 1 USD)
              </label>
              <button
                type="button"
                onClick={() => {
                  updateRates({ marketSource: 'auto' });
                  void runLiveRateFetch(true);
                }}
                className="text-xs text-[var(--accent)] font-medium cursor-pointer"
              >
                Use live rate
              </button>
            </div>
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
              Default tax ({settings.defaultTax.kind === 'percent' ? '%' : 'PKR'})
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
