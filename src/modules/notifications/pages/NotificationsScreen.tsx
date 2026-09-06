import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { ApiError } from '@shared/lib/functionsClient';
import { notificationService } from '../services/notificationService';
import { NotificationCard } from '../components/NotificationCard';
import type { AppNotification } from '../types/notification.types';

/**
 * Notifications screen (`/notifications`, SRS 12.10/23.17/24.16). Not a
 * Bottom Navigation Bar tab — SRS 24.8 fixes that tab set at exactly
 * Home/Announcements/Gallery/Library/More, so this is reached from the
 * TopBar bell icon instead (see TopBarNotificationBell.tsx), matching
 * "Add the notification entry point to the existing TopBar" without
 * redesigning the tab bar.
 *
 * FR-NOT-001: no opt-out/preference control exists anywhere on this
 * screen or elsewhere in the app — notifications cannot be disabled, by
 * design (BR-017/BR-047).
 */
export function NotificationsScreen() {
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { member, editorSession } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const identity = { sessionToken: editorSession?.sessionToken, memberId: member?.memberId };

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await notificationService.list(identity);
      setNotifications(result.notifications);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('notifications.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSession?.sessionToken, member?.memberId]);

  // SRS 24.16: "Notifications shall be grouped by date."
  const groups = useMemo(() => {
    const byDate = new Map<string, AppNotification[]>();
    for (const n of notifications) {
      const dateKey = new Date(n.created_at).toLocaleDateString();
      const bucket = byDate.get(dateKey) ?? [];
      bucket.push(n);
      byDate.set(dateKey, bucket);
    }
    return Array.from(byDate.entries());
  }, [notifications]);

  const handleSelect = async (notification: AppNotification) => {
    if (!notification.is_read && !isOffline) {
      setMarkingId(notification.notification_id);
      try {
        await notificationService.markRead(identity, notification.notification_id);
        setNotifications((prev) =>
          prev.map((n) => (n.notification_id === notification.notification_id ? { ...n, is_read: true } : n)),
        );
      } catch {
        // Best-effort: navigation should not be blocked by a failed read-state update.
      } finally {
        setMarkingId(null);
      }
    }

    if (notification.reference_type === 'announcement' && notification.reference_id) {
      navigate(`/announcements/${notification.reference_id}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-4 text-app-xl font-bold text-text-primary">{t('notifications.title')}</h1>

      {isOffline && (
        <p role="status" className="mb-4 rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
          {t('common.offline')} — {t('notifications.offlineNotice')}
        </p>
      )}

      {isLoading ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : loadError ? (
        <p role="alert" className="text-app-base text-danger">
          {loadError}
        </p>
      ) : notifications.length === 0 ? (
        <p className="text-app-base text-text-secondary">{t('notifications.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(([dateLabel, group]) => (
            <div key={dateLabel} className="flex flex-col gap-2">
              <h2 className="text-app-sm font-semibold text-text-secondary">{dateLabel}</h2>
              <div className="flex flex-col gap-2">
                {group.map((notification) => (
                  <NotificationCard
                    key={notification.notification_id}
                    notification={notification}
                    onSelect={() => void handleSelect(notification)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {markingId && <span className="sr-only" role="status">{t('common.loading')}</span>}
    </div>
  );
}
