-- =====================================================================
-- Task 10A — Gallery Module
-- =====================================================================
-- Implements the schema required by:
--   SRS Chapter 11 (Gallery Module — FR-GAL-001..017, NFR-GAL-001)
--   SRS 22.7  (Gallery Albums Table)
--   SRS 22.8  (Gallery Photos Table)
--   SRS BR-027–029, DP-008, SEC-020–022
--   SDD 4.6   (Gallery Module — GalleryController / ImageOptimizer /
--              FullScreenViewer)
--   SDD 5.5   (Data Integrity & Soft-Delete Strategy)
--
-- SECURITY MODEL — identical trust boundary to migration 0002/0003:
-- this project does NOT use Supabase Auth. All privileged reads/writes
-- go through Supabase Edge Functions (supabase/functions/gallery) using
-- the SERVICE ROLE key. RLS is enabled with NO permissive policies for
-- anon/authenticated on either table — deny-by-default — matching the
-- existing members/roles/audit_logs pattern.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 22.7 Gallery Albums table
-- ---------------------------------------------------------------------
-- album_type covers the four Gallery Home categories named in SRS 11.3/
-- FR-GAL-001: Daily Darshan, Festival, Sabha, Event. "Videos (Optional)"
-- is explicitly optional in the SRS and is not implemented here (no
-- video upload/storage requirement exists anywhere else in the SRS/SDD
-- for V1 — see 11.19 Future Expansion).
--
-- 'daily_darshan' is a SINGLETON album: FR-GAL-002 says every uploaded
-- Daily Darshan photograph automatically appears in "the Daily Darshan
-- Album" (singular, definite article) — it is not user-created like
-- Festival/Sabha/Event albums (FR-GAL-004/007/008), so a partial unique
-- index below guarantees at most one non-deleted 'daily_darshan' row
-- ever exists, and this migration seeds it once.
--
-- gen_random_uuid() is provided by pgcrypto, already enabled in
-- migration 0002.
create table if not exists gallery_albums (
  album_id uuid primary key default gen_random_uuid(),
  album_name text not null check (char_length(btrim(album_name)) > 0),
  album_type text not null
    check (album_type in ('daily_darshan', 'festival', 'sabha', 'event')),
  -- SRS 22.7 "cover_image" — stored as a private-bucket storage path,
  -- never a public URL (SEC-020); the gallery Edge Function signs a
  -- short-lived URL from this path on every read.
  cover_image_path text,
  -- FR-GAL-005: "Festival Date" shown on Festival Album cards. Optional
  -- and only meaningful for album_type = 'festival', but not
  -- constrained to it at the DB layer since Sabha/Event albums may also
  -- reasonably carry a date; the SRS does not forbid this.
  album_date date,
  created_by text references members (member_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- SDD 5.5: destructive actions set a status flag rather than removing
  -- the row. FR-GAL-015 distinguishes "delete" from "archive" as two
  -- separate Supreme-Administrator actions; both are modelled as
  -- non-destructive flags so historical photo references are never
  -- orphaned (mirrors the members.is_deleted soft-delete pattern).
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text references members (member_id),
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by text references members (member_id)
);

-- Enforces the Daily Darshan singleton described above.
create unique index if not exists idx_gallery_albums_daily_darshan_singleton
  on gallery_albums (album_type)
  where album_type = 'daily_darshan' and is_deleted = false;

create index if not exists idx_gallery_albums_type on gallery_albums (album_type);
create index if not exists idx_gallery_albums_created_at on gallery_albums (created_at desc);
create index if not exists idx_gallery_albums_is_deleted on gallery_albums (is_deleted);
create index if not exists idx_gallery_albums_name on gallery_albums (lower(album_name));

drop trigger if exists trg_gallery_albums_updated_at on gallery_albums;
create trigger trg_gallery_albums_updated_at
  before update on gallery_albums
  for each row execute function touch_updated_at();

-- Seed the singleton Daily Darshan album (FR-GAL-001/002). Idempotent:
-- only inserts if no non-deleted 'daily_darshan' row exists yet.
insert into gallery_albums (album_name, album_type)
select 'Daily Darshan', 'daily_darshan'
where not exists (
  select 1 from gallery_albums where album_type = 'daily_darshan' and is_deleted = false
);

-- ---------------------------------------------------------------------
-- 22.8 Gallery Photos table
-- ---------------------------------------------------------------------
create table if not exists gallery_photos (
  photo_id uuid primary key default gen_random_uuid(),
  album_id uuid not null references gallery_albums (album_id),
  -- Private-bucket storage path (never a public URL — SEC-020). The
  -- Edge Function signs a short-lived view URL from this path.
  storage_path text not null,
  -- FR-GAL-013: optional caption, user-authored, never translated.
  caption text,
  uploaded_by text references members (member_id),
  -- SRS 22.8 names this field "upload_time"; kept as the canonical
  -- name used across the schema/API/audit trail for this table.
  upload_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- FR-GAL-015/16.11 error handling: "never lose existing photographs
  -- due to upload failure" and album management is non-destructive —
  -- photo removal is a soft delete, consistent with SDD 5.5.
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text references members (member_id)
);

create index if not exists idx_gallery_photos_album on gallery_photos (album_id);
create index if not exists idx_gallery_photos_uploaded_by on gallery_photos (uploaded_by);
create index if not exists idx_gallery_photos_upload_time on gallery_photos (upload_time desc);
create index if not exists idx_gallery_photos_is_deleted on gallery_photos (is_deleted);
-- FR-GAL-017: search by Caption (among other fields handled at the
-- album level). A plain lower() index keeps ILIKE lookups reasonable
-- without requiring the pg_trgm extension, matching the existing
-- convention used for members.full_name in migration 0002.
create index if not exists idx_gallery_photos_caption on gallery_photos (lower(coalesce(caption, '')));

drop trigger if exists trg_gallery_photos_updated_at on gallery_photos;
create trigger trg_gallery_photos_updated_at
  before update on gallery_photos
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — deny-by-default (SDD 7.2/7.3, SEC-020)
-- ---------------------------------------------------------------------
alter table gallery_albums enable row level security;
alter table gallery_photos enable row level security;

-- Intentionally NO policies for anon/authenticated: every read and
-- write happens through the `gallery` Edge Function using the
-- service-role key, which bypasses RLS by design. Even public "view"
-- reads (FR-GAL: Gallery viewing has no PIN requirement — devotees
-- never authenticate) are served by that Edge Function using signed
-- Storage URLs, never direct PostgREST/table access from the client.

-- ---------------------------------------------------------------------
-- Storage — private `gallery` bucket (SEC-020/021/022, SDD 4.6)
-- ---------------------------------------------------------------------
-- Created directly via SQL against the storage schema so bucket
-- existence is captured in version control like every other schema
-- change, rather than depending on a manual Dashboard step.
-- public = false: objects are NEVER served from a public URL; every
-- read goes through a short-lived signed URL issued by the Edge
-- Function's service-role client (createSignedUrl), and every upload
-- goes through a short-lived signed UPLOAD URL (createSignedUploadUrl)
-- issued the same way — the anon key can never list or read this
-- bucket directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  false,
  8388608, -- 8 MB per file (SEC-022 configurable max — enforced again, authoritatively, in the Edge Function)
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally NO storage.objects RLS policies are added for
-- anon/authenticated: every upload and every read is brokered through
-- the `gallery` Edge Function's service-role client via short-lived
-- signed URLs (createSignedUploadUrl / createSignedUrl), which bypass
-- bucket RLS by design — the same deny-by-default trust boundary as
-- the rest of this schema (see migration 0002's RLS comment block).
