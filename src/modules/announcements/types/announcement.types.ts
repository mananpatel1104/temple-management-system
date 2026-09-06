/**
 * Announcement Module types (SRS Chapter 12; SDD 4.7). Mirrors the shape
 * returned by the `announcements` Edge Function
 * (supabase/functions/announcements).
 */

/** SRS 12.3 — the six announcement types. Each announcement belongs to exactly one. */
export type AnnouncementCategory = 'general' | 'festival' | 'mens' | 'ladies' | 'volunteer' | 'emergency';

/** SRS 12.8 — three priority levels. */
export type AnnouncementPriority = 'high' | 'medium' | 'low';

/** Effective lifecycle state, recomputed server-side on every read (see Edge Function's effectiveStatus()). */
export type AnnouncementStatus = 'scheduled' | 'published' | 'archived';

export type AnnouncementAttachmentType = 'image' | 'pdf' | 'link';

/** Categories a user could ever be permitted to create — used to drive the create-form's category picker. */
export const CREATABLE_CATEGORIES: AnnouncementCategory[] = [
  'general',
  'festival',
  'mens',
  'ladies',
  'volunteer',
  'emergency',
];

export interface Announcement {
  announcement_id: string;
  title: string;
  description: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  /** Optional creator-authored note (esp. Volunteer group name) — display only, never used for access control. */
  visibility_scope: string | null;
  attachment_type: AnnouncementAttachmentType | null;
  /** Short-lived signed URL for image/pdf attachments — never a public URL (mirrors Gallery's SEC-020 pattern). */
  attachment_url: string | null;
  /** SRS 12.9 — optional External Link attachment (mutually exclusive with attachment_url). */
  external_link: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  publish_at: string;
  expiry_date: string | null;
  status: AnnouncementStatus;
  is_archived: boolean;
}

export interface AnnouncementListResult {
  announcements: Announcement[];
  total: number;
}

export interface AnnouncementSearchResult {
  announcements: Announcement[];
}

export interface CreateAnnouncementInput {
  title: string;
  description: string;
  category: AnnouncementCategory;
  priority?: AnnouncementPriority;
  visibilityScope?: string;
  publishAt?: string;
  expiryDate?: string;
  externalLink?: string;
}

export interface UpdateAnnouncementInput {
  id: string;
  title?: string;
  description?: string;
  priority?: AnnouncementPriority;
  visibilityScope?: string;
  publishAt?: string;
  expiryDate?: string;
  externalLink?: string;
}

export interface RequestAttachmentUploadUrlResult {
  path: string;
  token: string;
  signedUrl: string;
}
