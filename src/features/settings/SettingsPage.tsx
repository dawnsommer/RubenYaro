import { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useStore, getSnapshots } from '../../store/useStore';
import { fetchLiveMarketRate, formatRelativeRateAge } from '../../lib/rates';
import { buildCostsCsv, downloadTextFile } from '../../lib/csv';
import {
  CURRENT_BUILD,
  VersionManifest,
  checkRemoteVersion,
  forceUpdateApp,
} from '../../lib/version';
import { ConversionMode, Currency, KeyDate, Settings } from '../../types';
import {
  Button,
  Card,
  Chip,
  ColorSwatch,
  DateInput,
  IconPicker,
  Segmented,
  Select,
  Switch,
} from '../../components/ui';

type SettingsSection =
  | 'currency'
  | 'journey'
  | 'categories'
  | 'appearance'
  | 'data'
  | 'about';

const LAST_BACKUP_KEY = 'rubenyaro:lastBackupAt';

export function SettingsPage() {
  const state = useStore();
  const { settings, costs, accounts, transactions } = state;

  const [section, setSection] = useState<SettingsSection>('currency');
  const [refreshing, setRefreshing] = useState(false);

  // Version & App Update state
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<VersionManifest | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const runVersionCheck = async () => {
    setCheckingVersion(true);
    const res = await checkRemoteVersion();
    setCheckingVersion(false);
    setRemoteVersion(res.remote);
    setUpdateAvailable(res.hasUpdate);
  };

  useEffect(() => {
    void runVersionCheck();
  }, []);

  // New Key Date
  const [kdLabel, setKdLabel] = useState('');
  const [kdDate, setKdDate] = useState<string | null>(null);
  const [kdKind, setKdKind] = useState<KeyDate['kind']>('exam');

  // New Category / Phase
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366F1');
  const [newCatIcon, setNewCatIcon] = useState('Receipt');

  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseColor, setNewPhaseColor] = useState('#14B8A6');

  // Data Import / Reset
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const [lastBackupIso, setLastBackupIso] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  });

  const snapshots = getSnapshots();

  const backupDaysAgo = lastBackupIso
    ? Math.floor((Date.now() - Date.parse(lastBackupIso)) / (1000 * 60 * 60 * 24))
    : null;

  const handleRefreshRate = async () => {
    setRefreshing(true);
    const res = await fetchLiveMarketRate(settings.rates, { force: true });
    setRefreshing(false);
    if (res) {
      state.updateRates({
        market: res.rate,
        marketProvider: res.provider,
        marketUpdatedAt: res.updatedAt,
        marketSource: 'auto',
      });
    }
  };

  const handleExportBackup = () => {
    const bundle = state.exportJSON();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `rubenyaro-backup-${dateStr}.json`,
      JSON.stringify(bundle, null, 2),
      'application/json'
    );
    const nowIso = new Date().toISOString();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LAST_BACKUP_KEY, nowIso);
    }
    setLastBackupIso(nowIso);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const res = state.importJSON(parsed, importMode);
        if (res.ok) {
          setImportStatus(
            `Successfully imported "${file.name}" (${importMode} mode).`
          );
        } else {
          setImportStatus(`Import failed: ${res.error}`);
        }
      } catch {
        setImportStatus('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const NAV: { id: SettingsSection; label: string }[] = [
    { id: 'currency', label: 'Currency & rates' },
    { id: 'journey', label: 'Journey & dates' },
    { id: 'categories', label: 'Categories & phases' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'data', label: 'Data & backup' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-micro">Preferences &amp; Backup</p>
          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-[24px] leading-[32px] font-semibold">Settings</h1>
            <Chip variant={updateAvailable ? 'warning' : 'accent'}>
              v{CURRENT_BUILD.version} · {CURRENT_BUILD.gitSha}
            </Chip>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runVersionCheck()}
            disabled={checkingVersion}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingVersion ? 'animate-spin' : ''}`} />
            {checkingVersion ? 'Checking…' : 'Check for update'}
          </Button>
          <Button
            size="sm"
            variant={updateAvailable ? 'primary' : 'secondary'}
            onClick={() => void forceUpdateApp()}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {updateAvailable
              ? `Update to ${remoteVersion?.gitSha ?? 'latest'}`
              : 'Update & Reload App'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left sub-nav on desktop, horizontal scroll on mobile (§6.6) */}
        <nav
          aria-label="Settings sections"
          className="col-span-12 lg:col-span-3 flex lg:flex-col gap-1 overflow-x-auto pb-1"
        >
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3.5 py-2 rounded-[10px] text-sm text-left whitespace-nowrap transition-colors cursor-pointer ${
                section === item.id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="col-span-12 lg:col-span-9 space-y-5">
          {/* 1. CURRENCY & RATES */}
          {section === 'currency' && (
            <Card
              title="Currency &amp; exchange rates"
              subtitle="Interbank rates can differ from open-market/bank card rates. Use Manual for your bank's actual rate."
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[var(--text-muted)]">
                        Market rate (PKR per 1 USD)
                      </label>
                      <Chip variant="accent">{settings.rates.marketSource}</Chip>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={settings.rates.market}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v > 0) {
                            state.updateRates({
                              market: v,
                              marketSource: 'manual',
                              marketUpdatedAt: new Date().toISOString(),
                            });
                          }
                        }}
                        className="flex-1 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
                      />
                      <Button
                        variant="secondary"
                        onClick={handleRefreshRate}
                        disabled={refreshing}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                        />
                        Sync live
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Provider: {settings.rates.marketProvider ?? 'default'} · Updated:{' '}
                      {formatRelativeRateAge(settings.rates.marketUpdatedAt)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      After-tax card / effective rate (default 300)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={settings.rates.effective}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v > 0) state.updateRates({ effective: v });
                      }}
                      className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Default conversion mode"
                    value={settings.defaultConversionMode}
                    onChange={(v) =>
                      state.updateSettings({
                        defaultConversionMode: v as ConversionMode,
                      })
                    }
                    options={[
                      {
                        value: 'effective',
                        label: `Effective / Card rate (₨${settings.rates.effective})`,
                      },
                      {
                        value: 'market',
                        label: `Market rate (₨${settings.rates.market})`,
                      },
                      { value: 'detailed', label: 'Detailed (market + tax)' },
                    ]}
                  />

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Primary display currency
                    </label>
                    <Segmented
                      options={[
                        { value: 'PKR', label: 'PKR (₨)' },
                        { value: 'USD', label: 'USD ($)' },
                      ]}
                      value={settings.displayCurrency}
                      onChange={(c) =>
                        state.updateSettings({ displayCurrency: c as Currency })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
                  <Select
                    label="Default tax rule kind (for Detailed mode)"
                    value={settings.defaultTax.kind}
                    onChange={(k) =>
                      state.updateSettings({
                        defaultTax: {
                          ...settings.defaultTax,
                          kind: k as 'percent' | 'fixed',
                        },
                      })
                    }
                    options={[
                      { value: 'percent', label: 'Percentage (%)' },
                      { value: 'fixed', label: 'Fixed PKR surcharge' },
                    ]}
                  />
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                      Default tax value (
                      {settings.defaultTax.kind === 'percent' ? '%' : 'PKR'})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={settings.defaultTax.value}
                      onChange={(e) =>
                        state.updateSettings({
                          defaultTax: {
                            ...settings.defaultTax,
                            value: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        })
                      }
                      className="w-full rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm num outline-none"
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 2. JOURNEY & KEY DATES */}
          {section === 'journey' && (
            <Card title="Journey &amp; key countdown dates">
              <div className="space-y-5">
                <DateInput
                  label="Overall journey target date (e.g. Match Day / Residency start)"
                  value={settings.journey.targetDate}
                  onChange={(d) =>
                    state.updateSettings({
                      journey: { ...settings.journey, targetDate: d },
                    })
                  }
                />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    Key exam &amp; deadline dates
                  </p>
                  {settings.journey.examDates.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      No key dates added yet.
                    </p>
                  ) : (
                    settings.journey.examDates.map((kd) => (
                      <div
                        key={kd.id}
                        className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--surface-2)] text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{kd.label}</span>
                          <Chip>{kd.kind}</Chip>
                          <span className="text-xs text-[var(--text-muted)] num">
                            {kd.date}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => state.deleteKeyDate(kd.id)}
                          aria-label="Delete key date"
                          className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3.5 rounded-[12px] border border-dashed border-[var(--border)] space-y-3">
                  <p className="text-xs font-medium text-[var(--text-muted)]">
                    + Add key date
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={kdLabel}
                      onChange={(e) => setKdLabel(e.target.value)}
                      placeholder="Label (e.g. Step 3)"
                      className="rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none"
                    />
                    <DateInput value={kdDate} onChange={setKdDate} />
                    <Select
                      value={kdKind}
                      onChange={(v) => setKdKind(v as KeyDate['kind'])}
                      options={[
                        { value: 'exam', label: 'Exam' },
                        { value: 'deadline', label: 'Deadline' },
                        { value: 'eligibility', label: 'Eligibility' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!kdLabel.trim() || !kdDate) return;
                      state.addKeyDate({
                        label: kdLabel.trim(),
                        date: kdDate,
                        kind: kdKind,
                      });
                      setKdLabel('');
                      setKdDate(null);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add date
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 3. CATEGORIES & PHASES */}
          {section === 'categories' && (
            <div className="space-y-5">
              <Card title="Phases">
                <div className="space-y-3">
                  {settings.phases.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-[10px] bg-[var(--surface-2)]"
                    >
                      <div className="flex items-center gap-2.5 flex-1">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            state.updatePhase(p.id, { name: e.target.value })
                          }
                          className="bg-transparent text-sm font-medium outline-none flex-1"
                        />
                      </div>
                      {settings.phases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => state.deletePhase(p.id)}
                          aria-label="Delete phase"
                          className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-2 border-t border-[var(--border)] space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPhaseName}
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        placeholder="New phase name"
                        className="flex-1 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!newPhaseName.trim()) return;
                          state.addPhase({
                            name: newPhaseName.trim(),
                            color: newPhaseColor,
                          });
                          setNewPhaseName('');
                        }}
                      >
                        Add phase
                      </Button>
                    </div>
                    <ColorSwatch value={newPhaseColor} onChange={setNewPhaseColor} />
                  </div>
                </div>
              </Card>

              <Card title="Categories">
                <div className="space-y-3">
                  {settings.categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-[10px] bg-[var(--surface-2)]"
                    >
                      <div className="flex items-center gap-2.5 flex-1">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) =>
                            state.updateCategory(cat.id, { name: e.target.value })
                          }
                          className="bg-transparent text-sm font-medium outline-none flex-1"
                        />
                      </div>
                      {settings.categories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => state.deleteCategory(cat.id)}
                          aria-label="Delete category"
                          className="text-[var(--text-muted)] hover:text-[var(--negative)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="pt-2 border-t border-[var(--border)] space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="New category name"
                        className="flex-1 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-sm outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!newCatName.trim()) return;
                          state.addCategory({
                            name: newCatName.trim(),
                            color: newCatColor,
                            icon: newCatIcon,
                          });
                          setNewCatName('');
                        }}
                      >
                        Add category
                      </Button>
                    </div>
                    <ColorSwatch value={newCatColor} onChange={setNewCatColor} />
                    <IconPicker value={newCatIcon} onChange={setNewCatIcon} />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 4. APPEARANCE */}
          {section === 'appearance' && (
            <Card title="Appearance &amp; privacy">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Theme
                  </label>
                  <Segmented
                    options={[
                      { value: 'system', label: 'System' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                    value={settings.theme}
                    onChange={(t) =>
                      state.updateSettings({
                        theme: t as Settings['theme'],
                      })
                    }
                  />
                </div>

                <Switch
                  checked={settings.privacyMode}
                  onChange={(privacyMode) => state.updateSettings({ privacyMode })}
                  label="Privacy mode (blur all monetary amounts for screen sharing)"
                />
              </div>
            </Card>
          )}

          {/* 5. DATA & BACKUP */}
          {section === 'data' && (
            <div className="space-y-5">
              {(backupDaysAgo === null || backupDaysAgo > 7) && (
                <div className="p-3.5 rounded-[12px] border border-[var(--warning)] bg-[var(--warning)]/10 flex items-center justify-between gap-3 text-xs">
                  <span className="inline-flex items-center gap-2 font-medium text-[var(--warning)]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {backupDaysAgo === null
                      ? 'You have not exported a JSON backup yet. Your data is stored only in this browser.'
                      : `Last backup: ${backupDaysAgo} days ago. Export a fresh JSON backup to keep your data safe.`}
                  </span>
                  <Button size="sm" onClick={handleExportBackup}>
                    Backup now
                  </Button>
                </div>
              )}

              <Card
                title="Backup &amp; Import"
                subtitle="Export full AppData JSON or import a backup / private seed file (such as private/my-data.json)."
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleExportBackup}>
                      <Download className="w-4 h-4" />
                      Export JSON backup
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const csv = buildCostsCsv(
                          costs,
                          settings,
                          transactions,
                          accounts
                        );
                        const dateStr = new Date().toISOString().slice(0, 10);
                        downloadTextFile(`rubenyaro-costs-${dateStr}.csv`, csv);
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Export costs CSV
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => state.loadStarterData()}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Load starter USMLE data
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-[var(--border)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        Import JSON (supports both full backup and seed format like{' '}
                        <code>private/my-data.json</code>)
                      </span>
                      <Segmented
                        options={[
                          { value: 'merge', label: 'Merge' },
                          { value: 'replace', label: 'Replace all' },
                        ]}
                        value={importMode}
                        onChange={setImportMode}
                      />
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      Choose JSON file to {importMode}…
                    </Button>

                    {importStatus && (
                      <p className="text-xs text-[var(--positive)] font-medium">
                        {importStatus}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {snapshots.length > 0 && (
                <Card
                  title="Auto-snapshots (last 5 days)"
                  subtitle="Automatic daily localStorage ring buffer."
                >
                  <div className="space-y-2">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.date}
                        className="flex items-center justify-between p-2.5 rounded-[10px] bg-[var(--surface-2)] text-xs"
                      >
                        <span className="font-medium num">{snap.date}</span>
                        <span className="text-[var(--text-muted)]">
                          {snap.data.costs.length} costs · {snap.data.accounts.length}{' '}
                          accounts
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => state.importJSON(snap.data, 'replace')}
                        >
                          Restore
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card
                title="Danger zone — Reset all data"
                subtitle="Type RESET below to wipe all accounts, transactions, costs, and tasks."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Type RESET to confirm"
                    className="rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none"
                  />
                  <Button
                    variant="danger"
                    disabled={resetConfirmText !== 'RESET'}
                    onClick={() => {
                      state.resetAllData();
                      setResetConfirmText('');
                    }}
                  >
                    Reset all
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* 6. ABOUT */}
          {section === 'about' && (
            <Card title="About &amp; App Version">
              <div className="space-y-4 text-sm">
                <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      Installed version
                    </span>
                    <span className="font-semibold num">
                      v{CURRENT_BUILD.version} ({CURRENT_BUILD.gitSha})
                    </span>
                  </div>
                  {CURRENT_BUILD.buildTime && (
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>Built at</span>
                      <span className="num">{CURRENT_BUILD.buildTime}</span>
                    </div>
                  )}
                  {remoteVersion && (
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                      <span>Latest deployed on server</span>
                      <span className="num font-medium text-[var(--text)]">
                        v{remoteVersion.version} ({remoteVersion.gitSha})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void runVersionCheck()}
                    disabled={checkingVersion}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${checkingVersion ? 'animate-spin' : ''}`}
                    />
                    Check for updates
                  </Button>
                  <Button onClick={() => void forceUpdateApp()}>
                    <Sparkles className="w-4 h-4" />
                    Force Update &amp; Clear App Cache
                  </Button>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  Schema version: <code>{settings.schemaVersion}</code> · Persist key:{' '}
                  <code>rubenyaro:v1</code>. Updating the app clears stale browser/PWA
                  asset caches while keeping all your saved financial data intact.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
