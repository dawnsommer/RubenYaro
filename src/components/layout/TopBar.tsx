import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw, Settings2, Search } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { fetchLiveMarketRate, formatRelativeRateAge } from '../../lib/rates';
import { NAV_ITEMS } from './nav';

export interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

const iconBtn =
  'inline-flex items-center justify-center w-9 h-9 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer shrink-0 transition-colors';

export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateRates = useStore((s) => s.updateRates);

  const [rateOpen, setRateOpen] = useState(false);
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
    if (settings.rates.marketSource === 'auto') void runLiveRateFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ageLabel = formatRelativeRateAge(settings.rates.marketUpdatedAt);
  const otherCurrency = settings.displayCurrency === 'PKR' ? 'USD' : 'PKR';

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-[var(--border)] backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
      >
        <div className="max-w-[1120px] mx-auto h-14 px-4 lg:px-6 flex items-center gap-2">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-2 shrink-0 mr-2">
            <span
              className="w-8 h-8 rounded-[10px] grid place-items-center text-white text-sm font-bold shadow-[var(--shadow-sm)]"
              style={{ background: 'linear-gradient(135deg, var(--hero-from), var(--hero-to))' }}
            >
              R
            </span>
            <span className="hidden sm:inline font-semibold tracking-[-0.02em] text-[15px]">
              RubenYaro
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-0.5 ml-2">
            {NAV_ITEMS.map(({ to, label, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest ? rest.end : undefined}
                className={({ isActive }) =>
                  `px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)] border border-[var(--border)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Rate pill */}
          <button
            type="button"
            onClick={() => {
              setDraftMarket(String(settings.rates.market));
              setDraftEffective(String(settings.rates.effective));
              setRateOpen(true);
            }}
            title={`Market rate, updated ${ageLabel}. Click to edit.`}
            className="inline-flex items-center gap-1.5 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] pl-2.5 pr-3 text-xs font-medium num hover:border-[var(--border-strong)] cursor-pointer shadow-[var(--shadow-sm)] min-w-0"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                offlineFailed ? 'bg-[var(--warning)]' : 'bg-[var(--positive)]'
              }`}
            />
            <span className="text-[var(--text)] font-semibold">
              ₨{settings.rates.market.toFixed(1)}
            </span>
            <span className="text-[var(--text-faint)] hidden sm:inline">
              · card ₨{settings.rates.effective}
            </span>
          </button>

          {/* Currency toggle */}
          <button
            type="button"
            onClick={() => updateSettings({ displayCurrency: otherCurrency })}
            title={`Show amounts in ${otherCurrency} (c)`}
            className="h-9 px-3 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold hover:border-[var(--border-strong)] cursor-pointer shadow-[var(--shadow-sm)] shrink-0"
          >
            {settings.displayCurrency}
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ privacyMode: !settings.privacyMode })}
            aria-label="Toggle privacy blur"
            title="Hide amounts (p)"
            className={`${iconBtn} ${settings.privacyMode ? '!text-[var(--accent)] bg-[var(--accent-soft)]' : ''}`}
          >
            {settings.privacyMode ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Search and commands"
            title="Search & commands (⌘K)"
            className={`${iconBtn} hidden md:inline-flex`}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              `${iconBtn} ${isActive ? '!text-[var(--text)] bg-[var(--surface-2)]' : ''}`
            }
          >
            <Settings2 className="w-[18px] h-[18px]" />
          </NavLink>
        </div>
      </header>

      <Sheet
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        size="sm"
        title="Exchange rates"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={() => {
                updateRates({ marketSource: 'auto' });
                void runLiveRateFetch(true).then(() => {
                  setDraftMarket(String(useStore.getState().settings.rates.market));
                });
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing…' : 'Sync live'}
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
                setRateOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Market rate · PKR per $1
            </label>
            <input
              type="number"
              step="0.1"
              value={draftMarket}
              onChange={(e) => setDraftMarket(e.target.value)}
              className="field num text-lg font-semibold"
            />
            <p className="text-xs text-[var(--text-faint)] mt-1.5">
              {settings.rates.marketSource === 'auto' ? 'Live' : 'Manual'} · updated {ageLabel}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Card rate after tax · PKR per $1
            </label>
            <input
              type="number"
              step="1"
              value={draftEffective}
              onChange={(e) => setDraftEffective(e.target.value)}
              className="field num text-lg font-semibold"
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
