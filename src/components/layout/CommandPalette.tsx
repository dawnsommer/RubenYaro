import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Receipt,
  Wallet,
  CheckCircle2,
  LineChart,
  Landmark,
  Settings2,
  Eye,
  RefreshCw,
  Download,
  ArrowLeftRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fetchLiveMarketRate } from '../../lib/rates';
import { downloadTextFile } from '../../lib/csv';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const state = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  if (!open) return null;

  const runAndClose = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center pt-20 p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg rounded-[22px] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden animate-pop-in"
      >
        <Command className="w-full" label="Command Palette">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search costs, tasks, accounts…"
              className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-2 text-sm">
            <Command.Empty className="py-6 text-center text-xs text-[var(--text-muted)]">
              No matching commands or items found.
            </Command.Empty>

            <Command.Group
              heading="Quick actions"
              className="text-[11px] font-semibold uppercase text-[var(--text-muted)] px-2 py-1"
            >
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/costs'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Add or manage costs</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/tasks'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Add or manage tasks</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/accounts'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Deposit, withdraw, or transfer funds</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  runAndClose(() =>
                    state.updateSettings({
                      displayCurrency:
                        state.settings.displayCurrency === 'PKR' ? 'USD' : 'PKR',
                    })
                  )
                }
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Toggle display currency (PKR ⇄ USD) (c)</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  runAndClose(() =>
                    state.updateSettings({
                      privacyMode: !state.settings.privacyMode,
                    })
                  )
                }
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Toggle privacy blur (p)</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  runAndClose(async () => {
                    const res = await fetchLiveMarketRate(state.settings.rates, {
                      force: true,
                    });
                    if (res) {
                      state.updateRates({
                        market: res.rate,
                        marketProvider: res.provider,
                        marketUpdatedAt: res.updatedAt,
                        marketSource: 'auto',
                      });
                    }
                  })
                }
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh live exchange rate</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  runAndClose(() => {
                    const bundle = state.exportJSON();
                    const date = new Date().toISOString().slice(0, 10);
                    downloadTextFile(
                      `rubenyaro-backup-${date}.json`,
                      JSON.stringify(bundle, null, 2),
                      'application/json'
                    );
                  })
                }
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON backup</span>
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading="Navigation"
              className="text-[11px] font-semibold uppercase text-[var(--text-muted)] px-2 py-1"
            >
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/costs'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Go to Costs</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/accounts'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Go to Accounts</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/tasks'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Go to Tasks</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/planner'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <LineChart className="w-4 h-4" />
                <span>Go to Planner</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/inheritance'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Landmark className="w-4 h-4" />
                <span>Go to Inheritance</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runAndClose(() => navigate('/settings'))}
                className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
              >
                <Settings2 className="w-4 h-4" />
                <span>Go to Settings</span>
              </Command.Item>
            </Command.Group>

            {state.costs.length > 0 && (
              <Command.Group
                heading="Costs"
                className="text-[11px] font-semibold uppercase text-[var(--text-muted)] px-2 py-1"
              >
                {state.costs.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`cost ${c.name}`}
                    onSelect={() => runAndClose(() => navigate(`/costs?open=${c.id}`))}
                    className="flex items-center justify-between px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-[var(--text-muted)] num">
                      {c.money.currency} {c.money.amount}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {state.tasks.length > 0 && (
              <Command.Group
                heading="Tasks"
                className="text-[11px] font-semibold uppercase text-[var(--text-muted)] px-2 py-1"
              >
                {state.tasks.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={`task ${t.title}`}
                    onSelect={() => runAndClose(() => navigate('/tasks'))}
                    className="flex items-center justify-between px-3 py-2 rounded-[10px] text-sm text-[var(--text)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--accent)] cursor-pointer"
                  >
                    <span>{t.title}</span>
                    <span className="text-xs text-[var(--text-muted)] capitalize">
                      {t.status}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
