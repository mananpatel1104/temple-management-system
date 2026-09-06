/**
 * Gallery Module types (SRS Chapter 11; SDD 4.6). Mirrors the shape
 * returned by the `gallery` Edge Function (supabase/functions/gallery).
 */

/** FR-GAL-001 — the four Gallery Home categories. "Videos (Optional)" is
 * not implemented (SRS 11.3 marks it optional; no video requirement
 * exists elsewhere in the SRS/SDD for V1). */
export type AlbumType = 'daily_darshan' | 'festival' | 'sabha' | 'event';

/** Only these types may be created by a user (FR-GAL-004/007/008) — Daily
 * Darshan is a seeded singleton (see migration 0004). */
export type CreatableAlbumType = Exclude<AlbumType, 'daily_darshan'>;

export interface GalleryAlbum {
  album_id: string;
  album_name: string;
  album_type: AlbumType;
  /** ISO date string (YYYY-MM-DD), FR-GAL-005 "Festival Date". */
  album_date: string | null;
  /** Short-lived signed URL (SEC-020) — never a public URL. */
  cover_image_url: string | null;
  photo_count: number;
  created_at: string;
  is_archived?: boolean;
}

export interface GalleryPhoto {
  photo_id: string;
  album_id: string;
  /** FR-GAL-013 — optional, user-authored, never translated. */
  caption: string | null;
  /** FR-GAL-014 — uploader's name, visible to all users. */
  uploaded_by_name: string | null;
  upload_time: string;
  /** Short-lived signed URL (SEC-020) — never a public URL. */
  photo_url: string | null;
}

export interface GallerySearchAlbumResult {
  album_id: string;
  album_name: string;
  album_type: AlbumType;
  album_date: string | null;
  cover_image_url: string | null;
}

export interface GallerySearchPhotoResult {
  photo_id: string;
  album_id: string;
  album_name: string | null;
  caption: string | null;
  upload_time: string;
  photo_url: string | null;
}

export interface GallerySearchResult {
  albums: GallerySearchAlbumResult[];
  photos: GallerySearchPhotoResult[];
}

export interface RequestUploadUrlResult {
  path: string;
  token: string;
  signedUrl: string;
}
