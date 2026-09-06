-- =====================================================================
-- Task 10B — Announcement Module (Announcement portion only; the
-- Notification portion of SRS Chapter 12 / SDD 4.7 is explicitly out of
-- scope for this task — see NOTE at the bottom of this file)
-- =====================================================================
-- Implements the schema required by:
--   SRS Chapter 12 (Announcement & Notification Module — FR-ANN-001..010)
--   SRS 22.6  (Announcements Table)
--   SRS BR-013..017, DP-008
--   SDD 4.7   (Announcement & Notification Module — AnnouncementController /
--              VisibilityResolver / ScheduledPublisher)
--   SDD 5.5   (Data Integrity & Soft-Delete Strategy)
--
-- SECURITY MODEL — identical trust boundary to migrations 0002/0003/0004:
-- this project does NOT use Supabase Auth. All privileged reads/writes
-- go through the `announcements` Supabase Edge Function using the
-- SERVICE ROLE key. RLS is enabled with NO permissive policies for
-- anon/authenticated — deny-by-default — matching the existing
-- members/roles/audit_logs/gallery pattern.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 22.6 Announcements table
-- ---------------------------------------------------------------------
-- category: the six SRS 12.3 types. 'mens'/'ladies' are the machine keys
-- for "Men's Sabha Announcement" / "Bhakti Mandal (Ladies) Announcement"
-- — kept short or ASCII-punctuation-free for a clean check-constraint /
-- application-code enum, matching the style of gallery_albums.album_type.
--
-- visibility_scope: SRS 22.6 lists "visibility" as a field distinct from
-- "category". FR-ANN-001..006/BR-013 define the actual access rule
-- purely as a function of category + requester role (enforced in the
-- Edge Function's VisibilityResolver, never trusted from client input) —
-- there is no per-member "volunteer group" table anywhere in the SRS
-- data model (Volunteer Management is explicitly listed as a *future*
-- enhancement, SRS 21.x/"Possible future enhancements"). So this column
-- is kept as an optional, creator-authored, DISPLAY-ONLY note (e.g. "Kitchen
-- Seva Volunteers") for the Volunteer category — it is never read by the
-- access-control logic. See supabase/functions/announcements/index.ts
-- header comment for the full VisibilityResolver rule table.
--
-- status: persisted for SDD 4.7 ScheduledPublisher, kept in sync by the
-- trigger below on every write AND by run_announcement_scheduler() for
-- pure time-passing transitions (see further down). Every read path in
-- the Edge Function ALSO recomputes the effective state from
-- publish_at/expiry_date/is_archived directly (defense in depth), so
-- correctness never depends on the scheduler having run recently.
create table if not exists announcements (
  announcement_id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  description text not null check (char_length(btrim(description)) > 0 and char_length(description) <= 5000),
  category text not null
    check (category in ('general', 'festival', 'mens', 'ladies', 'volunteer', 'emergency')),
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  visibility_scope text check (visibility_scope is null or char_length(visibility_scope) <= 150),

  -- Attachments (SRS 12.9 — optional Image, PDF, or External Link).
  -- Image/PDF live in the private `announcement-attachments` bucket
  -- (never the Gallery bucket — Task 10B §10); attachment_path is a
  -- storage path, signed on every read exactly like Gallery (SEC-020
  -- pattern). External Link is a plain validated URL, mutually
  -- exclusive with attachment_path at the application layer.
  attachment_path text,
  attachment_type text check (attachment_type is null or attachment_type in ('image', 'pdf', 'link')),
  external_link text check (external_link is null or char_length(external_link) <= 2048),

  created_by text references members (member_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- FR-ANN-008 scheduling: defaults to "publish immediately".
  publish_at timestamptz not null default now(),
  -- FR-ANN-009 optional expiry -> automatic archival.
  expiry_date timestamptz,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'published', 'archived')),

  -- SDD 5.5 non-destructive actions: archive (FR-ANN-009/010, BR-016,
  -- 12.15 "Archive"/"Restore") is distinct from delete (BR-015 "remove
  -- their own announcements", 23.6 DELETE endpoint) — same two-flag
  -- pattern as gallery_albums.
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by text references members (member_id),

  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text references members (member_id),

  check (expiry_date is null or expiry_date > publish_at)
);

create index if not exists idx_announcements_category on announcements (category);
create index if not exists idx_announcements_status on announcements (status);
create index if not exists idx_announcements_publish_at on announcements (publish_at desc);
create index if not exists idx_announcements_expiry_date on announcements (expiry_date);
create index if not exists idx_announcements_created_by on announcements (created_by);
create index if not exists idx_announcements_is_deleted on announcements (is_deleted);
create index if not exists idx_announcements_is_archived on announcements (is_archived);
-- FR-ANN: search by Title, Date, Category, Keywords (12.12).
create index if not exists idx_announcements_title on announcements (lower(title));
create index if not exists idx_announcements_description on announcements (lower(description));

-- ---------------------------------------------------------------------
-- status sync trigger (on-write transitions)
-- ---------------------------------------------------------------------
create or replace function announcements_sync_status()
returns trigger
language plpgsql
as $$
begin
  if new.is_archived then
    new.status := 'archived';
    if new.archived_at is null then
      new.archived_at := now();
    end if;
  elsif new.expiry_date is not null and new.expiry_date <= now() then
    new.status := 'archived';
    new.is_archived := true;
    new.archived_at := coalesce(new.archived_at, now());
  elsif new.publish_at <= now() then
    new.status := 'published';
  else
    new.status := 'scheduled';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_sync_status on announcements;
create trigger trg_announcements_sync_status
  before insert or update on announcements
  for each row execute function announcements_sync_status();

-- ---------------------------------------------------------------------
-- ScheduledPublisher (SDD 4.7) — bulk transition for rows where time has
-- passed WITHOUT any write happening (the trigger above only fires on
-- insert/update, so a purely time-based transition needs this separate
-- entry point). Intended to be invoked periodically by pg_cron (below);
-- Task 10B §7/19: "If the environment cannot deploy/test scheduled
-- Supabase infrastructure, implement the correct database/backend
-- structure and clearly report that live scheduling could not be
-- verified" — see the final report for that disclosure. Every read path
-- in the Edge Function additionally recomputes the effective
-- published/archived state directly from publish_at/expiry_date, so
-- visibility is correct even on a deployment where this has never run.
-- ---------------------------------------------------------------------
create or replace function run_announcement_scheduler()
returns void
language plpgsql
as $$
begin
  update announcements
    set status = 'published'
    where status = 'scheduled'
      and publish_at <= now()
      and not is_deleted;

  update announcements
    set status = 'archived', is_archived = true, archived_at = now()
    where status = 'published'
      and expiry_date is not null
      and expiry_date <= now()
      and not is_deleted
      and not is_archived;
end;
$$;

-- Best-effort: schedule the function via pg_cron if that extension is
-- available in this Supabase project (Dashboard > Database > Extensions
-- > pg_cron). Wrapped so migration deploy never hard-fails in an
-- environment where pg_cron isn't enabled/permitted.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'announcements-scheduler',
      '*/5 * * * *',
      'select run_announcement_scheduler();'
    );
  else
    raise notice 'pg_cron extension not installed — run_announcement_scheduler() will not run automatically. Enable pg_cron in the Supabase Dashboard, or invoke it on a schedule via an external trigger, to activate live scheduled publish/expiry transitions. Read-time visibility filtering does not depend on this and remains correct either way.';
  end if;
exception when others then
  raise notice 'pg_cron scheduling could not be configured (%): run_announcement_scheduler() will not run automatically. Read-time visibility filtering does not depend on this and remains correct either way.', sqlerrm;
end $$;

drop trigger if exists trg_announcements_updated_at on announcements;
-- (No separate touch_updated_at trigger: announcements_sync_status()
-- above already sets updated_at on every write, so adding the generic
-- touch_updated_at trigger too would just run twice for no benefit.)

-- ---------------------------------------------------------------------
-- Row Level Security — deny-by-default (SDD 7.2/7.3, SEC-020)
-- ---------------------------------------------------------------------
alter table announcements enable row level security;

-- Intentionally NO policies for anon/authenticated: every read
-- (including the public "View Announcements" ✅-for-Devotee case — SRS
-- 12.15) and every write happens through the `announcements` Edge
-- Function using the service-role key, exactly like Gallery.

-- ---------------------------------------------------------------------
-- Storage — private `announcement-attachments` bucket (Task 10B §10)
-- ---------------------------------------------------------------------
-- Deliberately a SEPARATE bucket from `gallery` (Task 10B §10: "Do NOT
-- reuse the Gallery bucket"). Same private + signed-URL trust boundary
-- as migration 0004. PDFs are meaningfully larger than the Gallery
-- 8 MB image cap, so this bucket's limit is a bit higher.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-attachments',
  'announcement-attachments',
  false,
  10485760, -- 10 MB (SEC-022-style configurable max — enforced again, authoritatively, in the Edge Function)
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally NO storage.objects RLS policies: every upload and every
-- read is brokered through the `announcements` Edge Function's
-- service-role client via short-lived signed URLs, same as Gallery.

-- =====================================================================
-- NOTE — Notifications (SRS 12.10, FR-NOT-001..003; SDD 5.4
-- `notifications` table; SDD 4.7 NotificationDispatcher) are Task 10C,
-- NOT this migration. No `notifications` table is created here. The
-- only concession made for a future clean integration is that
-- `announcements.status` transitions to 'published' in exactly one
-- place (announcements_sync_status() above / run_announcement_scheduler()),
-- giving Task 10C a single, well-defined point to hook a dispatch call
-- from without altering this schema.
-- =====================================================================
