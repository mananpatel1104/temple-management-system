import { useEffect, useState } from 'react';
import { useAuth } from '@modules/auth/context/AuthContext';
import { notificationService } from '../services/notificationService';

/**
 * Best-effort unread count for the TopBar bell badge (SRS 24.16
 * "unread indicator"). Deliberately silent on failure (offline, network
 * error, etc.) — a missing/stale badge count must never surface as an
 * error banner in the app shell; the Notifications screen itself is
 * still the source of truth and shows its own loadError if the network
 * call fails there.
 */
export function useUnreadNotificationCount(): number {
  const { member, editorSession } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void notificationService
      .list({ sessionToken: editorSession?.sessionToken, memberId: member?.memberId }, 1)
      .then((result) => {
        if (!cancelled) setUnreadCount(result.unread_count ?? 0);
      })
      .catch(() => {
        // Silent — see file header.
      });
    return () => {
      cancelled = true;
    };
  }, [member?.memberId, editorSession?.sessionToken]);

  return unreadCount;
}
