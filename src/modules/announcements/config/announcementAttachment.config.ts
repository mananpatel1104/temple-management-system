/** Mirrors supabase/functions/_shared/validation.ts — kept in sync manually, same as other client-side pre-validation in this app (e.g. Gallery's upload constraints). The Edge Function remains the authoritative check. */
export const ANNOUNCEMENT_ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
