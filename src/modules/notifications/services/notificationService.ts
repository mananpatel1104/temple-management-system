import { ApiError, functionsClient } from '@shared/lib/functionsClient';
import { cacheNotificationsMetadata, getCachedNotificationsMetadata } from '@offline/cacheStrategies';
import type { NotificationListResult } from '../types/notification.types';

/**
 * NotificationController-equivalent client service (SDD 4.7/5.4). See
 * `supabase/functions/notifications/index.ts` header for the full
 * identity/ownership model this mirrors: an authenticated editor
 * forwards their session token exactly like announcementService does;
 * a Devotee (no session ever exists for that role) forwards their own
 * locally-stored member_id instead, since that is the only identity a
 * Devotee has anywhere in this application (see AuthContext's
 * `member.memberId`, set at registration).
 */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'NETWORK';
}

export const notificationService = {
  async list(
    identity: { sessionToken?: string | null; memberId?: string | null },
    limit = 50,
  ): Promise<NotificationListResult> {
    const cacheKey = `list:${identity.memberId ?? 'editor'}:${limit}`;
    try {
      const result = await functionsClient.post<NotificationListResult>(
        'notifications',
        { action: 'list', memberId: identity.memberId ?? undefined, limit },
        identity.sessionToken,
      );
      void cacheNotificationsMetadata(cacheKey, result);
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedNotificationsMetadata<NotificationListResult>(cacheKey);
      if (!cached) throw error;
      return cached;
    }
  },

  async markRead(
    identity: { sessionToken?: string | null; memberId?: string | null },
    notificationId: string,
  ): Promise<void> {
    // Intentionally never cache-served — Mark as Read is a mutation and
    // always requires the network (see cacheStrategies.ts header note).
    await functionsClient.post(
      'notifications',
      { action: 'markRead', id: notificationId, memberId: identity.memberId ?? undefined },
      identity.sessionToken,
    );
  },
};
