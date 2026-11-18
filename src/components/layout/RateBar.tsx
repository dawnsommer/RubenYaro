import { useEffect, useState } from 'react';
import { Eye, EyeOff, SunMoon, RefreshCw, Command } from 'lucide-react';
import { Segmented } from '../ui/Segmented';
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

  const [rateSheetOpen, setRateSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);

  const [draftMarket, setDraftMarket] = useState(String(settings.rates.market));
  const [draftEffective, setDraftEffective] = useState(String(settings.rates.effective));

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

  return (
    <>
      <header
        className="sticky top-0 z-20 h-12 flex items-center gap-2 px-3 sm:px-6 lg:px-8 border-b border-[var(--border)] text-xs backdrop-blur-md"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        {/* Market + After-tax rate pill (tappable to edit) */}
        <button
          type="button"
          onClick={() => {
            setDraftMarket(String(settings.rates.market));
            setDraftEffective(String(settings.rates.effective));
            setRateSheetOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium num hover:border-[var(--accent)] cursor-pointer truncate"
          title={`Updated ${ageLabel}. Tap to edit rates.`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              offlineFailed ? 'bg-[var(--warning)]' : 'bg-[var(--positive)]'
            }`}
          />
          <span className="font-semibold text-[var(--text)]">
            $1 = ₨{settings.rates.market.toFixed(1)}
          </span>
          <span className="text-[var(--text-muted)] text-[11px]">
            (×{settings.rates.effective} after tax)
          </span>
        </button>

        {/* Dedicated 1-tap Refresh Live Rate button */}
        <button
          type="button"
          onClick={() => void runLiveRateFetch(true)}
          disabled={refreshing}
          aria-label="Refresh live exchange rate"
          title="Refresh live market rate"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">
            {refreshing ? 'Refreshing…' : 'Refresh rate'}
          </span>
        </button>

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
          className={`inline-flex items-center justify-center rounded-full border border-[var(--border)] w-8 h-8 text-xs cursor-pointer shrink-0 ${
            settings.privacyMode
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {settings.privacyMode ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label="Toggle theme"
          title="Toggle dark/light theme"
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] w-8 h-8 text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer shrink-0"
        >
          <SunMoon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          aria-label="Command palette"
          className="hidden md:inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <Command className="w-3 h-3" />K
        </button>
      </header>

      <Sheet
        open={rateSheetOpen}
        onClose={() => setRateSheetOpen(false)}
        title="Exchange rates"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                updateRates({ marketSource: 'auto' });
                void runLiveRateFetch(true);
                setRateSheetOpen(false);
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync live rate
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const m = parseFloat(draftMarket);
                const ef = parseFloat(draftEffective);
                if (m > 0 && m !== settings.rates.market) {
                  updateRates({
                    market: m,
                    marketSource: 'manual',
                    marketUpdatedAt: new Date().toISOString(),
                  });
                }
                if (ef > 0) updateRates({ effective: ef });
                setRateSheetOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Actual Market Rate (PKR per $1 USD)
            </label>
            <input
              type="number"
              step="0.1"
              value={draftMarket}
              onChange={(e) => setDraftMarket(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Last updated: {ageLabel} ({settings.rates.marketSource})
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              After-Tax Card Rate (default ₨300 per $1 USD)
            </label>
            <input
              type="number"
              step="1"
              value={draftEffective}
              onChange={(e) => setDraftEffective(e.target.value)}
              className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
