export interface VersionManifest {
  version: string;
  gitSha: string;
  buildTime: string;
}

export const CURRENT_BUILD: VersionManifest = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0',
  gitSha: typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '',
};

export async function checkRemoteVersion(): Promise<{
  remote: VersionManifest | null;
  hasUpdate: boolean;
}> {
  if (typeof window === 'undefined') {
    return { remote: null, hasUpdate: false };
  }
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const url = `${baseUrl}version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { remote: null, hasUpdate: false };
    const remote = (await res.json()) as VersionManifest;
    const hasUpdate =
      Boolean(remote.gitSha && remote.gitSha !== CURRENT_BUILD.gitSha) ||
      Boolean(remote.buildTime && remote.buildTime !== CURRENT_BUILD.buildTime);
    return { remote, hasUpdate };
  } catch {
    return { remote: null, hasUpdate: false };
  }
}

/**
 * Unregisters RubenYaro's service worker, deletes RubenYaro's caches, and reloads with a cache-busting query param.
 * dawnsommer.github.io also hosts other apps (Thunder tracker, ThunderShadow…) that share the origin's
 * service-worker registrations and CacheStorage — only touch our own scope / `rubenyaro-` caches.
 * Preserves localStorage (`rubenyaro:v1`) so zero user data is lost.
 */
export async function forceUpdateApp(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const scope = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      await Promise.all(registrations.filter((r) => r.scope.startsWith(scope)).map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('rubenyaro-')).map((k) => window.caches.delete(k)));
    }
  } catch {
    // proceed to reload even if SW cleanup throws
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}
