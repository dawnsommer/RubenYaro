import { useState } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw, RotateCcw } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import {
  clearReplacedCopy,
  connect,
  disconnect,
  getReplacedCopy,
  syncNow,
  useCloudStatus,
} from '../../lib/cloud';
import { useStore } from '../../store/useStore';

function ago(iso: string) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function SyncCard() {
  const cloud = useCloudStatus();
  const importJSON = useStore((s) => s.importJSON);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tone =
    cloud.state === 'synced'
      ? 'text-[var(--positive)]'
      : cloud.state === 'error' || cloud.state === 'expired'
        ? 'text-[var(--warning)]'
        : 'text-[var(--text-muted)]';
  const replaced = cloud.hasBackup ? getReplacedCopy() : null;

  return (
    <Card
      title="Google sync"
      subtitle="Same Google sign-in as Thunder tracker. Your data stays on this device and is copied to a private app folder in your Google Drive, so your phone shows the same data."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[14px] bg-[var(--surface-2)] px-4 py-3">
          <span
            className={`w-9 h-9 shrink-0 rounded-[12px] grid place-items-center ${
              cloud.connected ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--surface-3)] text-[var(--text-muted)]'
            }`}
          >
            {cloud.connected ? <Cloud className="w-[18px] h-[18px]" /> : <CloudOff className="w-[18px] h-[18px]" />}
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {cloud.connected ? cloud.account || 'Signed in with Google' : 'Not signed in'}
            </p>
            <p className={`text-xs mt-0.5 ${tone}`}>
              {cloud.message ||
                (cloud.connected
                  ? `Last synced ${ago(cloud.lastSync)}${cloud.pending ? ' · changes waiting' : ''}`
                  : 'Sign in to keep your data on all your devices.')}
            </p>
            {cloud.connected && cloud.sharedFrom && (
              <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Using the {cloud.sharedFrom} sign-in in this browser.</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!cloud.connected ? (
            <Button disabled={busy} onClick={() => run(() => connect())}>
              <Cloud className="w-4 h-4" />
              {cloud.canBorrow ? `Sign in (use ${cloud.canBorrow})` : 'Sign in with Google'}
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={() => run(() => syncNow({ manual: true }))}>
                <RefreshCw className={`w-4 h-4 ${cloud.state === 'syncing' || busy ? 'animate-spin' : ''}`} />
                Sync now
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(() => disconnect())}>
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </>
          )}
        </div>
        {err && <p className="text-xs text-[var(--warning)]">{err}</p>}
        {!cloud.connected && !cloud.onSite && !cloud.canBorrow && (
          <p className="text-xs text-[var(--text-muted)]">
            Sign-in works on the published app: dawnsommer.github.io/RubenYaro
          </p>
        )}

        {replaced && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[var(--border)] px-3.5 py-2.5 text-xs">
            <span className="text-[var(--text-muted)]">
              Kept a copy sync replaced ({replaced.why.toLowerCase()}, {ago(replaced.savedAt)}).
            </span>
            <span className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  importJSON(replaced.data, 'replace');
                  clearReplacedCopy();
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => clearReplacedCopy()}>
                Dismiss
              </Button>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
