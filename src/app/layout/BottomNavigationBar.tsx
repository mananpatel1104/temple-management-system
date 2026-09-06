import { NavLink } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { appRoutes, type AppRouteConfig } from '@app/router/routes.config';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Tiny hand-authored inline icon set — deliberately not an icon library
 * dependency, keeping the bundle (and offline cache) minimal per the
 * project's ₹0-budget / low-end-Android-device principles (DP-007).
 */
function NavIcon({ name }: { name: AppRouteConfig['navIcon'] }) {
  switch (name) {
    case 'home':
      return (
        <svg {...ICON_PROPS} stroke="currentColor" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case 'announcements':
      return (
        <svg {...ICON_PROPS} stroke="currentColor" aria-hidden="true">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M15 8a4 4 0 0 1 0 8" />
        </svg>
      );
    case 'gallery':
      return (
        <svg {...ICON_PROPS} stroke="currentColor" aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 5-5 3.5 3.5L16 12l4 5" />
        </svg>
      );
    case 'library':
      return (
        <svg {...ICON_PROPS} stroke="currentColor" aria-hidden="true">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20Z" />
        </svg>
      );
    case 'more':
      return (
        <svg {...ICON_PROPS} stroke="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Fixed Bottom Navigation Bar (SRS 24.8): Home, Announcements, Gallery,
 * Library, More — the active tab is visually highlighted. Tabs are driven
 * entirely by the central route registry (routes.config.ts), so this
 * component never needs to change when a module's route changes.
 *
 * Uses `position: fixed`, so it renders full-width relative to the
 * viewport regardless of RootLayout's max-width reading column.
 */
export function BottomNavigationBar() {
  const { t } = useLanguage();

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-surface-light/95 pb-safe-bottom backdrop-blur dark:border-white/10 dark:bg-surface-dark/95"
    >
      <div className="mx-auto flex w-full max-w-screen-md items-stretch justify-around">
        {appRoutes.map((route) => (
          <NavLink
            key={route.path}
            to={`/${route.path}`}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-app-sm ${
                isActive ? 'font-semibold text-saffron' : 'text-text-secondary'
              }`
            }
          >
            <NavIcon name={route.navIcon} />
            <span>{t(route.navLabelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
