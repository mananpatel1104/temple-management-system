/**
 * Small, dependency-free validation helpers shared by every Edge
 * Function (SDD 6.1 "Request Validation (schema check)" pipeline step).
 */

export const PIN_PATTERN = /^\d{4,6}$/; // 4–6 digit numeric PIN (SRS gives "1234" as the example format)
export const MOBILE_PATTERN = /^\+?[0-9\s-]{7,15}$/;

/**
 * Must match APP_CONFIG.supportedLanguages in src/config/app.config.ts
 * (the app's single, existing language-selection flow) and the
 * `preferred_language` check constraint added in migration 0003. Kept
 * as a literal list (rather than imported) because Edge Functions run
 * in Deno and do not share a bundler/module graph with the Vite
 * frontend — do not add a language here without adding it there too.
 */
export const SUPPORTED_LANGUAGES = ['gu', 'hi', 'en'] as const;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Task 12D Deep Security Audit — Input Validation / Database Security.
 *
 * Several Edge Functions build a PostgREST `.or(...)` filter expression
 * by interpolating a user-supplied free-text search string directly
 * into the filter string (e.g. `title.ilike.%${query}%`). PostgREST's
 * filter grammar treats comma as an OR-condition separator and treats
 * parentheses/periods as structural characters, so an unescaped
 * user-controlled value can inject additional filter clauses into that
 * expression (a "PostgREST filter injection") instead of being treated
 * as a single opaque search term. It cannot cross into a different
 * top-level filter (those are separate, independently-AND-ed query
 * parameters — see e.g. the `.eq('is_deleted', false)` / `.in(...)`
 * calls surrounding every use of this helper), but it can still distort
 * the intended search-text condition and is fixed here as defense in
 * depth (SDD 6.1 "server-side is authoritative"; do not rely on the
 * value only ever containing "normal" search text).
 *
 * PostgREST resolves this by allowing a filter value to be wrapped in
 * double quotes, at which point it is treated as one literal string;
 * backslash and double-quote characters inside that literal must
 * themselves be backslash-escaped. This mirrors PostgREST's own
 * documented escaping rules for its `or=(...)` syntax.
 */
export function escapePostgrestFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function validateFullName(name: unknown): string | null {
  if (!isNonEmptyString(name)) return 'Name is required.';
  if (name.trim().length > 120) return 'Name is too long.';
  return null;
}

export function validateOptionalMobile(mobile: unknown): string | null {
  if (mobile === undefined || mobile === null || mobile === '') return null;
  if (typeof mobile !== 'string' || !MOBILE_PATTERN.test(mobile.trim())) {
    return 'Mobile number format is invalid.';
  }
  return null;
}

export function validatePin(pin: unknown): string | null {
  if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
    return 'PIN must be 4 to 6 digits.';
  }
  return null;
}

/** FR-AUTH-003/22.4 Preferred Language — required at registration. */
export function validatePreferredLanguage(language: unknown): string | null {
  if (typeof language !== 'string' || !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    return 'Preferred language must be one of: gu, hi, en.';
  }
  return null;
}

/** Same as validatePreferredLanguage but allows omission (defaults to 'gu' at the DB layer). */
export function validateOptionalPreferredLanguage(language: unknown): string | null {
  if (language === undefined || language === null || language === '') return null;
  return validatePreferredLanguage(language);
}

/**
 * Gallery file-upload security (SEC-020/021/022, SDD 7.4): allow-list of
 * MIME types and a configurable maximum size, both enforced here
 * authoritatively — the client also pre-checks the same limits, but
 * that check is a convenience only, never trusted (SDD 6.1 pipeline
 * "server-side is authoritative").
 */
export const GALLERY_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const GALLERY_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB — mirrors the `gallery` storage bucket's file_size_limit (migration 0004)

export function validateGalleryMimeType(mimeType: unknown): string | null {
  if (typeof mimeType !== 'string' || !(GALLERY_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return 'Only JPEG and PNG images are supported.';
  }
  return null;
}

export function validateGalleryFileSize(fileSize: unknown): string | null {
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) return 'File size is required.';
  if (size > GALLERY_MAX_FILE_SIZE_BYTES) return 'File exceeds the maximum upload size of 8 MB.';
  return null;
}

/** FR-GAL-013: captions are optional, user-authored, never translated — just length-bounded. */
export function validateOptionalCaption(caption: unknown): string | null {
  if (caption === undefined || caption === null || caption === '') return null;
  if (typeof caption !== 'string') return 'Caption must be text.';
  if (caption.length > 300) return 'Caption is too long.';
  return null;
}

export function validateAlbumName(name: unknown): string | null {
  if (!isNonEmptyString(name)) return 'Album name is required.';
  if (name.trim().length > 150) return 'Album name is too long.';
  return null;
}

const GALLERY_USER_CREATABLE_ALBUM_TYPES = ['festival', 'sabha', 'event'] as const;

/** FR-GAL-004/007/008 — Daily Darshan is a seeded singleton, never user-created (see migration 0004). */
export function validateCreatableAlbumType(albumType: unknown): string | null {
  if (
    typeof albumType !== 'string' ||
    !(GALLERY_USER_CREATABLE_ALBUM_TYPES as readonly string[]).includes(albumType)
  ) {
    return 'albumType must be one of: festival, sabha, event.';
  }
  return null;
}

/**
 * Announcement Module validation (SRS Chapter 12 / Task 10B). Mirrors
 * the CHECK constraints in migration 0005 — kept in the Edge Function
 * too so a bad request gets a clean 400 with a helpful message instead
 * of a raw Postgres constraint-violation error.
 */
export const ANNOUNCEMENT_CATEGORIES = ['general', 'festival', 'mens', 'ladies', 'volunteer', 'emergency'] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_PRIORITIES = ['high', 'medium', 'low'] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export function validateAnnouncementTitle(title: unknown): string | null {
  if (!isNonEmptyString(title)) return 'Title is required.';
  if (title.trim().length > 200) return 'Title is too long (200 characters max).';
  return null;
}

export function validateAnnouncementDescription(description: unknown): string | null {
  if (!isNonEmptyString(description)) return 'Description is required.';
  if (description.trim().length > 5000) return 'Description is too long (5000 characters max).';
  return null;
}

export function validateAnnouncementCategory(category: unknown): string | null {
  if (typeof category !== 'string' || !(ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(category)) {
    return 'category must be one of: general, festival, mens, ladies, volunteer, emergency.';
  }
  return null;
}

/** Priority is optional on create/update — omission defaults to 'medium' at the controller layer. */
export function validateOptionalAnnouncementPriority(priority: unknown): string | null {
  if (priority === undefined || priority === null || priority === '') return null;
  if (typeof priority !== 'string' || !(ANNOUNCEMENT_PRIORITIES as readonly string[]).includes(priority)) {
    return 'priority must be one of: high, medium, low.';
  }
  return null;
}

export function validateOptionalVisibilityScope(scope: unknown): string | null {
  if (scope === undefined || scope === null || scope === '') return null;
  if (typeof scope !== 'string') return 'visibilityScope must be text.';
  if (scope.length > 150) return 'visibilityScope is too long (150 characters max).';
  return null;
}

/** FR-ANN-008 — optional; omission means "publish immediately" (DB default `now()`). */
export function validateOptionalPublishAt(publishAt: unknown): string | null {
  if (publishAt === undefined || publishAt === null || publishAt === '') return null;
  if (typeof publishAt !== 'string' || Number.isNaN(Date.parse(publishAt))) {
    return 'publishAt must be a valid ISO date/time.';
  }
  return null;
}

/** FR-ANN-009 — optional expiry; must be strictly after publishAt (checked at the controller layer, where both values are known). */
export function validateOptionalExpiryDate(expiryDate: unknown): string | null {
  if (expiryDate === undefined || expiryDate === null || expiryDate === '') return null;
  if (typeof expiryDate !== 'string' || Number.isNaN(Date.parse(expiryDate))) {
    return 'expiryDate must be a valid ISO date/time.';
  }
  return null;
}

/** SRS 12.9 — optional External Link attachment. */
export function validateOptionalExternalLink(link: unknown): string | null {
  if (link === undefined || link === null || link === '') return null;
  if (typeof link !== 'string' || link.length > 2048) return 'External link is invalid.';
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'External link must start with http:// or https://.';
    }
  } catch {
    return 'External link is not a valid URL.';
  }
  return null;
}

/** SRS 12.9 — Image or PDF attachment, stored in the private `announcement-attachments` bucket (Task 10B §10, never the Gallery bucket). */
export const ANNOUNCEMENT_ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors the bucket's file_size_limit (migration 0005)

export function validateAnnouncementAttachmentMimeType(mimeType: unknown): string | null {
  if (typeof mimeType !== 'string' || !(ANNOUNCEMENT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return 'Only JPEG, PNG, or PDF attachments are supported.';
  }
  return null;
}

export function validateAnnouncementAttachmentFileSize(fileSize: unknown): string | null {
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) return 'File size is required.';
  if (size > ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_BYTES) return 'File exceeds the maximum upload size of 10 MB.';
  return null;
}

/**
 * SRS Chapter 10 (Task 10D) — Live Darshan / Live Katha stream URL and
 * Katha Archive watch URL. Same http(s)-only allowlist rationale as
 * validateOptionalExternalLink above (SEC — "do not allow arbitrary
 * unsafe URL schemes"); a stream link is REQUIRED input for the
 * configure action (unlike the announcement external link, which is
 * optional), so this validator rejects empty input rather than treating
 * it as "no value".
 */
export function validateStreamUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.trim().length === 0) return 'Stream URL is required.';
  if (url.length > 2048) return 'Stream URL is too long (2048 characters max).';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Stream URL must start with http:// or https://.';
    }
  } catch {
    return 'Stream URL is not a valid URL.';
  }
  return null;
}

/** Same allowlist as validateStreamUrl, but optional — used by clearStream/unconfigured states. */
export function validateOptionalStreamUrl(url: unknown): string | null {
  if (url === undefined || url === null || url === '') return null;
  return validateStreamUrl(url);
}

/** FR-LIVE-005 — Katha title, required when configuring the Live Katha stream. */
export function validateOptionalKathaTitle(title: unknown): string | null {
  if (title === undefined || title === null || title === '') return null;
  if (typeof title !== 'string' || title.length > 200) return 'Katha title is too long (200 characters max).';
  return null;
}

/** FR-LIVE-005 — Speaker Name is explicitly Optional. */
export function validateOptionalSpeakerName(name: unknown): string | null {
  if (name === undefined || name === null || name === '') return null;
  if (typeof name !== 'string' || name.length > 150) return 'Speaker name is too long (150 characters max).';
  return null;
}

/** FR-LIVE-008/010 — plain calendar date (YYYY-MM-DD), used for the Saturday Katha schedule and Katha Archive entries. */
export function validateOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Please provide a valid date.';
  return null;
}

/** FR-LIVE-010 — Katha Archive date is a required field (unlike the Saturday schedule's optional date). */
export function validateRequiredDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0 || Number.isNaN(Date.parse(value))) {
    return 'A valid date is required.';
  }
  return null;
}

/** FR-LIVE-008 — HH:MM (24h) time-of-day, used for the Saturday Katha schedule. */
export function validateOptionalTime(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return 'Please provide a valid time (HH:MM).';
  }
  return null;
}

/** FR-LIVE-008 — Venue text field. */
export function validateOptionalVenue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 200) return 'Venue is too long (200 characters max).';
  return null;
}

/** FR-LIVE-010 — Katha Archive entry title. */
export function validateArchiveTitle(title: unknown): string | null {
  if (typeof title !== 'string' || title.trim().length === 0) return 'Title is required.';
  if (title.length > 200) return 'Title is too long (200 characters max).';
  return null;
}

/** FR-LIVE-010 — Thumbnail is explicitly Optional; same http(s) allowlist as other URL fields. */
export function validateOptionalThumbnailUrl(url: unknown): string | null {
  if (url === undefined || url === null || url === '') return null;
  if (typeof url !== 'string' || url.length > 2048) return 'Thumbnail URL is invalid.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Thumbnail URL must start with http:// or https://.';
    }
  } catch {
    return 'Thumbnail URL is not a valid URL.';
  }
  return null;
}
