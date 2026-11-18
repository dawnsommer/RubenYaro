/**
 * Optional Google sync — same sign-in as Thunder tracker / ThunderShadow.
 *
 * - Sign-in goes through the shared Cloudflare Worker (it keeps the Google refresh token). This page keeps
 *   only the Worker session and a short-lived Drive access token. Never log or export either.
 * - RubenYaro has its own sign-in (`app_id=rubenyaro` on the Worker's allow-list); it never reads or
 *   touches the Thunder tracker / ThunderShadow sessions that share this origin.
 * - Data = one JSON file `rubenyaro-state.json` in the Drive appDataFolder (private to these apps).
 * - Local-first: every edit saves to this browser first; a sync runs ~5 s after you stop editing
 *   (at most 30 s), when you leave the page, and when you come back (at most every 2 min).
 * - Conflicts are whole-document: the newer edit wins and the other copy is kept as a local backup
 *   (Settings → Sync → "Restore the copy replaced by sync").
 */
import { useSyncExternalStore } from 'react';
import type { AppData } from '../types';
import { migrate, isValidAppData } from '../store/migrations';

const CFG = {
  appId: 'rubenyaro',
  workerUrl: 'https://study-tools-auth-worker.summerofdawn20.workers.dev',
  returnUrl: 'https://dawnsommer.github.io/RubenYaro/',
};
const FILE_NAME = 'rubenyaro-state.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DEBOUNCE_MS = 5000;
const MAX_WAIT_MS = 30000;
const CHECK_EVERY_MS = 2 * 60000;
const TOKEN_SKEW_MS = 60000;

const K = {
  session: 'rubenyaro:cloud-session',
  shared: 'rubenyaro:cloud-shared', // name of the app whose sign-in we borrowed ('' = our own)
  account: 'rubenyaro:cloud-account',
  last: 'rubenyaro:cloud-last-sync',
  sig: 'rubenyaro:cloud-remote-sig',
  dirty: 'rubenyaro:cloud-dirty', // timestamp of the first unsynced local edit
  editedAt: 'rubenyaro:cloud-edited-at', // timestamp of the latest local edit
  device: 'rubenyaro:cloud-device-id',
  token: 'rubenyaro:cloud-token',
  backup: 'rubenyaro:cloud-replaced-copy',
};

const get = (k: string) => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const put = (k: string, v: string) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* storage full / blocked */
  }
};

export type CloudState = 'signedout' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error' | 'expired';
export interface CloudStatus {
  state: CloudState;
  message: string;
  connected: boolean;
  account: string;
  lastSync: string;
  sharedFrom: string;
  pending: boolean;
  onSite: boolean;
  hasBackup: boolean;
}

export interface CloudApp {
  getData: () => AppData;
  applyRemote: (data: AppData) => void;
}

let app: CloudApp | null = null;
let token = '';
let tokenExp = 0;
let tokenP: Promise<string> | null = null;
let syncP: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastCheck = 0;
let failures = 0;
let retryAt = 0;
let callbackError = '';
let st: { state: CloudState; message: string } = { state: 'signedout', message: '' };
const subs = new Set<() => void>();
let snapshot: CloudStatus | null = null; // computed lazily (helpers below are consts)

const session = () => get(K.session);
const onSite = () =>
  typeof location !== 'undefined' && location.href.toLowerCase().startsWith(CFG.returnUrl.toLowerCase());
const worker = (path: string) => CFG.workerUrl.replace(/\/$/, '') + path;
const authError = (msg: string) => Object.assign(new Error(msg), { auth: true });

function deviceId() {
  let d = get(K.device);
  if (!d) {
    d = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    put(K.device, d);
  }
  return d;
}

function computeStatus(): CloudStatus {
  return {
    state: st.state,
    message: st.message,
    connected: !!session(),
    account: get(K.account),
    lastSync: get(K.last),
    sharedFrom: get(K.shared),
    pending: !!get(K.dirty),
    onSite: onSite(),
    hasBackup: !!get(K.backup),
  };
}
function emit() {
  snapshot = computeStatus();
  subs.forEach((fn) => fn());
}
function set(state: CloudState, message = '') {
  st = { state, message };
  emit();
}

/**
 * The Worker sends the browser back to returnUrl#cloud-auth=<session>. Take it out of the address bar
 * before HashRouter reads the hash. Call once, before rendering.
 */
export function captureAuthCallback() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!/(^|&)cloud-(auth|error)=/.test(raw)) return;
  const params = new URLSearchParams(raw);
  const s = params.get('cloud-auth') || '';
  callbackError = params.get('cloud-error') || '';
  try {
    history.replaceState(null, document.title, location.pathname + location.search + '#/settings');
  } catch {
    /* ignore */
  }
  if (s) {
    put(K.session, s);
    put(K.shared, '');
    put(K.last, '');
    put(K.sig, '');
    put(K.token, '');
  }
}

async function timed(url: string, opts: RequestInit, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } catch (e) {
    throw ctl.signal.aborted ? new Error('Google didn’t answer in time.') : e;
  } finally {
    clearTimeout(t);
  }
}

function forget() {
  token = '';
  tokenExp = 0;
  [K.session, K.shared, K.account, K.last, K.sig, K.dirty, K.token].forEach((k) => put(k, ''));
}

const fingerprint = (x: string) => {
  let h = 0;
  for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

function cachedToken() {
  try {
    const c = JSON.parse(get(K.token) || 'null');
    if (c && c.f === fingerprint(session()) && c.exp > Date.now() + TOKEN_SKEW_MS && c.token) {
      token = c.token;
      tokenExp = c.exp;
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function getToken(force = false): Promise<string> {
  if (!force && token && tokenExp > Date.now() + TOKEN_SKEW_MS) return token;
  if (!force && cachedToken()) return token;
  if (tokenP) return tokenP;
  const s = session();
  if (!s) throw authError('Not signed in.');
  tokenP = (async () => {
    const res = await timed(
      worker('/token'),
      { method: 'POST', headers: { Authorization: 'Bearer ' + s, Accept: 'application/json' }, cache: 'no-store' },
      15000
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const borrowed = get(K.shared);
        forget();
        set(
          'expired',
          borrowed
            ? `The ${borrowed} sign-in in this browser has expired. Sign in again — your data is safe on this device.`
            : 'Your Google sign-in expired. Sign in again to resume syncing — your data is safe on this device.'
        );
        throw authError('Google sign-in expired.');
      }
      throw new Error(body?.error?.message || body?.message || `Sign-in service error (${res.status}).`);
    }
    const t = String(body.access_token || body.accessToken || body.google_access_token || body.token || '');
    if (!t) throw new Error('The sign-in service returned no Google access token.');
    token = t;
    const abs = body.expires_at ?? body.expiresAt;
    const secs = Number(body.expires_in ?? body.expiresIn ?? 3600);
    tokenExp =
      abs != null
        ? typeof abs === 'number'
          ? abs > 1e10
            ? abs
            : abs * 1000
          : Date.parse(abs)
        : Date.now() + Math.max(60, secs || 3600) * 1000;
    if (!Number.isFinite(tokenExp)) tokenExp = Date.now() + 3e6;
    put(K.token, JSON.stringify({ f: fingerprint(s), token, exp: tokenExp }));
    const email = String(body.email || body.account_email || body.accountEmail || body.account?.email || '');
    if (email) put(K.account, email);
    return token;
  })().finally(() => {
    tokenP = null;
  });
  return tokenP;
}

async function drive(url: string, opts: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(opts.headers || {});
  headers.set('Authorization', 'Bearer ' + (await getToken()));
  const res = await timed(url, { ...opts, headers, cache: 'no-store' }, 20000);
  if (res.status === 401 && retry) {
    token = '';
    put(K.token, '');
    await getToken(true);
    return drive(url, opts, false);
  }
  return res;
}
async function driveJson(url: string, opts: RequestInit, what: string) {
  const res = await drive(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `${what} failed (${res.status}).`);
  return body;
}

interface DriveFile {
  id: string;
  modifiedTime?: string;
  md5Checksum?: string;
  appProperties?: Record<string, string>;
}
const sigOf = (f: DriveFile) => [f.id, f.modifiedTime || '', f.md5Checksum || ''].join(':');

async function findFile(): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '10',
    fields: 'files(id,name,modifiedTime,md5Checksum,appProperties)',
  });
  const body = await driveJson(`${DRIVE}/files?${params}`, {}, 'Reading Google Drive');
  const files: DriveFile[] = body.files || [];
  return files.find((f) => !f.appProperties?.appId || f.appProperties.appId === CFG.appId) ?? null;
}

interface CloudDoc {
  app: string;
  kind: 'state';
  formatVersion: 1;
  updatedAt: string;
  device: string;
  data: AppData;
}

async function download(file: DriveFile): Promise<CloudDoc | null> {
  const res = await drive(`${DRIVE}/files/${encodeURIComponent(file.id)}?alt=media`);
  if (!res.ok) throw new Error(`Downloading from Google Drive failed (${res.status}).`);
  return res.json().catch(() => null);
}

async function upload(file: DriveFile | null, doc: CloudDoc): Promise<DriveFile> {
  const fields = 'id,modifiedTime,md5Checksum';
  if (file) {
    return driveJson(
      `${UPLOAD}/files/${encodeURIComponent(file.id)}?uploadType=media&fields=${fields}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(doc) },
      'Saving to Google Drive'
    );
  }
  const boundary = 'rubenyaro-' + deviceId().slice(0, 8) + Date.now().toString(36);
  const meta = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
    appProperties: { appId: CFG.appId, kind: 'state', formatVersion: '1' },
  };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(doc)}\r\n--${boundary}--`;
  return driveJson(
    `${UPLOAD}/files?uploadType=multipart&fields=${fields}`,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    'Saving to Google Drive'
  );
}

const docOf = (data: AppData): CloudDoc => ({
  app: CFG.appId,
  kind: 'state',
  formatVersion: 1,
  updatedAt: new Date(Number(get(K.editedAt)) || Date.now()).toISOString(),
  device: deviceId(),
  data,
});
const same = (a: AppData, b: AppData) => JSON.stringify(a) === JSON.stringify(b);

function keepBackup(data: AppData, why: string) {
  put(K.backup, JSON.stringify({ savedAt: new Date().toISOString(), why, data }));
}

export function syncNow(opts: { manual?: boolean } = {}): Promise<void> {
  if (!app) return Promise.resolve();
  if (!session()) return opts.manual ? connect() : Promise.resolve();
  if (!navigator.onLine) {
    set('offline', 'Offline — changes are saved on this device and will sync when you’re back online.');
    return Promise.resolve();
  }
  if (syncP) {
    again = true;
    return syncP;
  }
  if (timer) clearTimeout(timer);
  timer = null;
  const a = app;
  syncP = (async () => {
    set('syncing', 'Syncing with your Google account…');
    const dirtyAt = get(K.dirty);
    const first = !get(K.last);
    const file = await findFile();
    const local = a.getData();
    let result = local;
    let needUpload = !file || !!dirtyAt;

    if (file && (first || sigOf(file) !== get(K.sig))) {
      const doc = await download(file);
      if (doc && doc.app === CFG.appId && isValidAppData(doc.data)) {
        const remote = migrate(doc.data, doc.data.settings?.schemaVersion ?? 1);
        if (!same(remote, local)) {
          const localNewer = !!dirtyAt && !first && (Number(get(K.editedAt)) || 0) > Date.parse(doc.updatedAt || '');
          if (localNewer) {
            keepBackup(remote, 'Google copy replaced by newer edits on this device');
            needUpload = true;
          } else {
            // first sync on this device, or the Google copy is newer: Google wins, keep this device's copy
            keepBackup(local, first ? 'This device’s data before the first sync' : 'Older edits on this device');
            result = remote;
            a.applyRemote(remote);
            needUpload = false;
          }
        } else {
          needUpload = false;
        }
      }
    }

    let sigNow = file ? sigOf(file) : '';
    if (needUpload) sigNow = sigOf(await upload(file, docOf(result)));
    put(K.sig, sigNow);
    if (get(K.dirty) === dirtyAt) put(K.dirty, '');
    else again = true;
    put(K.last, new Date().toISOString());
    lastCheck = Date.now();
    failures = 0;
    retryAt = 0;
    const acct = get(K.account);
    set('synced', `Synced with Google${acct ? ` (${acct})` : ''}.`);
  })()
    .catch((e: Error & { auth?: boolean }) => {
      if (!e?.auth) {
        if (!navigator.onLine) set('offline', 'Offline — changes are saved on this device.');
        else {
          failures++;
          const wait = Math.min(15 * 60000, 30000 * 2 ** (failures - 1));
          retryAt = Date.now() + wait;
          set(
            'error',
            `Couldn’t sync — your data is safe on this device. Retrying in ${
              wait < 60000 ? Math.round(wait / 1000) + ' s' : Math.round(wait / 60000) + ' min'
            }. ${e?.message || ''}`
          );
          if (get(K.dirty)) schedule(wait);
        }
      }
      if (opts.manual) throw e;
    })
    .finally(() => {
      syncP = null;
      if (again) {
        again = false;
        schedule();
      }
    });
  return syncP;
}

function schedule(minWait = 0) {
  if (!session()) return;
  if (timer) clearTimeout(timer);
  const now = Date.now();
  const first = Number(get(K.dirty)) || now;
  const wait = Math.max(minWait, retryAt - now, Math.min(DEBOUNCE_MS, first + MAX_WAIT_MS - now), 0);
  timer = setTimeout(() => {
    timer = null;
    syncNow().catch(() => {});
  }, wait);
}

/** Call on every local edit. */
export function markDirty() {
  const now = String(Date.now());
  if (!get(K.dirty)) put(K.dirty, now);
  put(K.editedAt, now);
  if (session()) schedule();
  emit();
}

export async function connect(): Promise<void> {
  if (session()) return syncNow({ manual: true });
  if (!onSite()) {
    const msg = `Google sign-in works on the published site (${CFG.returnUrl}).`;
    set('error', msg);
    throw new Error(msg);
  }
  set('connecting', 'Opening Google sign-in…');
  const params = new URLSearchParams({ app_id: CFG.appId, return_url: CFG.returnUrl, device_id: deviceId() });
  const url = `${worker('/oauth/start')}?${params}`;
  // Ask the Worker first so a refusal (app not on its allow-list) is explained here, not on a raw error page.
  try {
    const res = await timed(url, { redirect: 'manual', cache: 'no-store', credentials: 'omit' }, 8000);
    if (res.type !== 'opaqueredirect' && res.status >= 400) {
      const body = await res.json().catch(() => ({}));
      const code = String(body.error || body.message || `HTTP ${res.status}`);
      const msg = /return_url|redirect/i.test(code)
        ? `The sign-in service doesn’t have ${CFG.returnUrl} on its allow-list (“${code}”). Your data is safe on this device.`
        : `The sign-in service refused the request (“${code}”). Your data is safe on this device.`;
      set('error', msg);
      throw Object.assign(new Error(msg), { refused: true });
    }
  } catch (e) {
    if ((e as { refused?: boolean }).refused) throw e;
  }
  location.assign(url);
}

export async function disconnect() {
  const s = session();
  const borrowed = get(K.shared);
  if (s && !borrowed && navigator.onLine) {
    try {
      await timed(
        worker('/disconnect'),
        { method: 'POST', headers: { Authorization: 'Bearer ' + s, Accept: 'application/json' }, cache: 'no-store' },
        15000
      );
    } catch {
      /* ignore */
    }
  }
  if (timer) clearTimeout(timer);
  timer = null;
  forget();
  set(
    'signedout',
    borrowed
      ? `Sync is off on this device. ${borrowed} stays signed in.`
      : 'Signed out. Your data stays on this device and in your Google account.'
  );
}

/** The copy sync replaced last time (to undo a sync). */
export function getReplacedCopy(): { savedAt: string; why: string; data: AppData } | null {
  try {
    return JSON.parse(get(K.backup) || 'null');
  } catch {
    return null;
  }
}
export function clearReplacedCopy() {
  put(K.backup, '');
  emit();
}

function foreground() {
  if (!session() || !navigator.onLine || Date.now() < retryAt) return;
  const seen = Math.max(lastCheck, Date.parse(get(K.last)) || 0);
  if (get(K.dirty) || Date.now() - seen > CHECK_EVERY_MS) syncNow().catch(() => {});
}

export function initCloud(api: CloudApp) {
  if (app) return;
  app = api;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') foreground();
    else if (get(K.dirty) && session() && navigator.onLine && !syncP) syncNow().catch(() => {});
  });
  window.addEventListener('online', () => {
    failures = 0;
    retryAt = 0;
    foreground();
  });
  window.addEventListener('offline', () => {
    if (session()) set('offline', 'Offline — changes are saved on this device.');
  });
  if (callbackError) set('error', `Google sign-in didn’t finish: ${callbackError}`);
  else if (session()) {
    set('connecting', 'Restoring Google sync…');
    syncNow().catch(() => {});
  } else set('signedout');
}

export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => (snapshot ??= computeStatus())
  );
}
