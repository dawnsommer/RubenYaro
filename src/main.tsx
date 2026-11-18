import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { App } from './App';
import { captureAuthCallback } from './lib/cloud';
import { startCloudSync } from './store/cloudBridge';

// Google sign-in returns as #cloud-auth=… — take it out before HashRouter reads the hash.
captureAuthCallback();
startCloudSync();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Ignore service worker registration errors in unsupported environments
      });
  });
}
