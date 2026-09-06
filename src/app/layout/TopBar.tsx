import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useUnreadNotificationCount } from '@modules/notifications/hooks/useUnreadNotificationCount';

/**
 * MainLayout TopBar (SDD 8.1 App Shell -> MainLayout -> TopBar).
 *
 * Branding only for now (temple icon + name). The SDD also specifies a
 * search icon and a personalised greeting on this bar — those depend on
 * the Universal Search module (SRS FR-DASH-019) and on devotee
 * registration data (Auth module) respectively, neither of which exists
 * yet, so they are intentionally left out per Task 4 scope rather than
 * being built as non-functional UI.
 *
 * Task 10C adds a single notification bell icon (SRS 24.16 "unread
 * indicator") on the right — the only addition made to this file; the
 * layout, branding, and prior behaviour are otherwise unchanged.
 */
export function TopBar() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotificationCount();

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-black/10 bg-surface-light/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-surface-dark/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <img
        src={`${import.meta.env.BASE_URL}icons/icon-72x72.png`}
        alt=""
        className="h-8 w-8 rounded-full"
      />
      <span className="truncate text-app-base font-semibold text-text-primary">
        {t('app.name')}
      </span>

      <button
        type="button"
        onClick={() => navigate('/notifications')}
        aria-label={
          unreadCount > 0
            ? t('notifications.bellAriaLabelUnread').replace('{count}', String(unreadCount))
            : t('notifications.bellAriaLabel')
        }
        className="relative ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-semibold leading-none text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
}
