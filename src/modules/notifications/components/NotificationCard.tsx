import { useLanguage } from '@app/providers/LanguageProvider';
import type { AppNotification } from '../types/notification.types';

interface NotificationCardProps {
  notification: AppNotification;
  onSelect: () => void;
}

/** SRS 24.16: "Each notification card shall display Icon, Title, Time, Status (Read/Unread)." */
export function NotificationCard({ notification, onSelect }: NotificationCardProps) {
  const { t } = useLanguage();
  const isUnread = !notification.is_read;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={notification.title}
      className={`flex w-full items-start gap-3 rounded-card border p-4 text-left shadow-[var(--shadow-card)] ${
        isUnread
          ? 'border-saffron/40 bg-saffron/5 dark:border-saffron/30 dark:bg-saffron/10'
          : 'border-black/10 bg-surface-light dark:border-white/10 dark:bg-surface-dark'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isUnread ? 'bg-saffron/20 text-saffron' : 'bg-black/10 text-text-secondary dark:bg-white/10'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`text-app-base ${isUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'}`}>
            {notification.title}
          </h3>
          {isUnread && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-saffron" aria-label={t('notifications.status.unread')} />
          )}
        </div>
        <p className="text-app-sm text-text-secondary">
          {new Date(notification.created_at).toLocaleString()}
        </p>
        <p className="text-app-sm text-text-secondary">
          {isUnread ? t('notifications.status.unread') : t('notifications.status.read')}
        </p>
      </div>
    </button>
  );
}
