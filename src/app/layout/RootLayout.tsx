import { Outlet } from 'react-router-dom';
import { useOffline } from '@app/providers/OfflineProvider';
import { useLanguage } from '@app/providers/LanguageProvider';

/**
 * Mobile-first responsive application shell (SRS 24.18 Responsive Design,
 * DP-007 usable on older Android devices).
 *
 * This is the outermost "App Shell" node (SDD 8.1): a scrollable content
 * region constrained to a comfortable reading width on larger screens,
 * plus a persistent offline banner. It wraps EVERY route, including the
 * Welcome Screen, so it deliberately does not render navigation chrome
 * itself — the Bottom Navigation Bar + TopBar (SRS 24.8 / SDD 8.1) live in
 * the nested MainLayout (src/app/layout/MainLayout.tsx), which only wraps
 * routes reachable after language selection is complete. See
 * src/app/router/AppRouter.tsx for how the two layouts are composed.
 */
export function RootLayout() {
  const { isOffline } = useOffline();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-light text-app-base dark:bg-surface-dark">
      {isOffline && (
        <div
          role="status"
          className="w-full bg-warning/90 px-4 py-2 text-center text-app-sm text-white"
        >
          {t('common.offline')}
        </div>
      )}

      <main className="mx-auto flex w-full max-w-screen-md flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
