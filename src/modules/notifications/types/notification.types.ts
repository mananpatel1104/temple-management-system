/**
 * Notification Module types (SRS 12.10, 23.17, 24.16; SDD 5.4). Mirrors
 * the shape returned by the `notifications` Edge Function
 * (supabase/functions/notifications).
 */

/** SDD 5.4 reference_type domain — only 'announcement' is dispatched by any trigger today (Task 10C scope). */
export type NotificationReferenceType = 'announcement' | 'festival' | 'thal';

export interface AppNotification {
  notification_id: string;
  title: string;
  reference_type: NotificationReferenceType;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  total: number;
  /** null only if the unread-count query itself failed server-side; the list still loaded. */
  unread_count: number | null;
}
