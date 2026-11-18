import type { AppData } from '../types';
import { initCloud, markDirty } from '../lib/cloud';
import { pickAppData, useStore } from './useStore';

/**
 * What counts as an edit for sync. The live market rate refreshes on every app open, so it is left out
 * (otherwise just opening the app would look like a newer edit than another device's real changes).
 */
function syncKey(d: AppData): string {
  const auto = d.settings.rates.marketSource === 'auto';
  const rates = auto
    ? { ...d.settings.rates, market: 0, marketUpdatedAt: null, marketProvider: null }
    : d.settings.rates;
  return JSON.stringify({ ...d, settings: { ...d.settings, rates } });
}

export function startCloudSync() {
  let applying = false;
  let lastKey = syncKey(pickAppData(useStore.getState()));

  useStore.subscribe((state, prev) => {
    if (
      state.settings === prev.settings &&
      state.accounts === prev.accounts &&
      state.transactions === prev.transactions &&
      state.costs === prev.costs &&
      state.tasks === prev.tasks &&
      state.inheritance === prev.inheritance
    )
      return;
    const key = syncKey(pickAppData(state));
    if (key === lastKey) return;
    lastKey = key;
    if (!applying) markDirty();
  });

  initCloud({
    getData: () => pickAppData(useStore.getState()),
    applyRemote: (data) => {
      applying = true;
      try {
        const cur = useStore.getState().settings;
        // keep this device's live rate if it's fresher; everything else comes from the synced copy
        const rates =
          data.settings.rates.marketSource === 'auto' && cur.rates.marketSource === 'auto'
            ? { ...data.settings.rates, market: cur.rates.market, marketUpdatedAt: cur.rates.marketUpdatedAt, marketProvider: cur.rates.marketProvider }
            : data.settings.rates;
        useStore.setState({ ...data, settings: { ...data.settings, rates } });
        lastKey = syncKey(pickAppData(useStore.getState()));
      } finally {
        applying = false;
      }
    },
  });
}
