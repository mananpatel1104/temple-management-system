import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from '@offline/serviceWorkerRegistration';
import '@styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registers the PWA service worker (see vite.config.ts for the Workbox
// caching strategy). Kept out of App.tsx so it runs exactly once, outside
// the React render tree, per TECH-004/DP-005 offline requirements.
registerServiceWorker({
  onNeedRefresh: () => {
    console.info('[PWA] New version available. Refresh to update.');
  },
  onOfflineReady: () => {
    console.info('[PWA] App is ready to work offline.');
  },
  onRegisterError: (error) => {
    console.error('[PWA] Service worker registration failed:', error);
  },
});
