import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface OfflineContextValue {
  /** True when the browser reports no network connectivity. */
  isOffline: boolean;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(
  undefined,
);

/**
 * OfflineProvider (SRS TECH-004/DP-005 — offline-first behaviour for
 * built-in content). Exposes live network status via the browser's
 * online/offline events so any component can adapt (e.g. disable actions
 * that require the network, show an offline indicator).
 *
 * This provider only tracks connectivity state — actual request caching
 * is handled by the service worker (see src/offline/serviceWorkerRegistration.ts).
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = useMemo(() => ({ isOffline }), [isOffline]);

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return ctx;
}
