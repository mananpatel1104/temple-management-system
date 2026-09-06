-- =====================================================================
-- Task 10D — Live Darshan & Katha Module
-- =====================================================================
-- Implements the schema required by:
--   SRS Chapter 10 (Live Darshan & Katha Module — FR-LIVE-001..014)
--   SRS 10.9  (Permissions table)
--   SDD 4.5   (Live Darshan & Katha Module — LiveStatusController /
--              KathaArchiveController)
--
-- SECURITY MODEL — identical trust boundary to migrations 0002/0003/
-- 0004/0005/0006: this project does NOT use Supabase Auth. All reads/
-- writes go through the `live-darshan` Supabase Edge Function using the
-- SERVICE ROLE key. RLS is enabled with NO permissive policies for
-- anon/authenticated — deny-by-default, matching every prior migration.
--
-- SCOPE NOTE — LIVE/OFFLINE derivation (SDD 4.5 "the client polls a
-- lightweight status endpoint to render LIVE/OFFLINE state; no
-- persistent video infrastructure is required"): neither the SRS nor
-- the SDD specifies any mechanism by which this application could
-- automatically detect whether an *external* platform (YouTube/
-- Facebook/etc.) is currently broadcasting — doing so would require a
-- paid third-party API integration, which directly contradicts the
-- explicit ₹0-budget constraint (SRS 10.1/10.2). The only budget-
-- neutral design consistent with FR-LIVE-002/006 ("if the stream is
-- currently active, display LIVE") is therefore a manually-toggled
-- `is_live` flag set by the Supreme Administrator alongside the stream
-- URL (FR-LIVE-013/014 already establishes the Supreme Administrator as
-- the sole configurator of stream state). This is the one place this
-- task infers an implementation mechanism rather than finding it
-- spelled out verbatim — flagged here and in the final report per the
-- task brief's "do not invent requirements" instruction, since a
-- mechanism must exist for the page to render anything at all.
-- =====================================================================

-- ---------------------------------------------------------------------
-- live_stream_config — one row per stream_type ('darshan' | 'katha').
-- Reuses a single small config table rather than inventing a generic
-- key/value settings table (none exists yet in this project — the SDD's
-- "settings/qr_configuration-style" reference describes a *shape*
-- convention, not an existing table to join into) and rather than two
-- near-identical tables, since Darshan and Katha configuration share
-- every column except the katha-only descriptive fields required by
-- FR-LIVE-005 (title/speaker/date/time), which are simply NULL for the
-- 'darshan' row.
-- ---------------------------------------------------------------------
create table if not exists live_stream_config (
  config_id uuid primary key default gen_random_uuid(),
  stream_type text not null check (stream_type in ('darshan', 'katha')),
  stream_url text,
  is_live boolean not null default false,
  -- FR-LIVE-005 Live Katha fields — always NULL for stream_type = 'darshan'.
  katha_title text,
  speaker_name text,
  katha_date date,
  katha_time time,
  updated_by text references members (member_id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Exactly one config row per stream type (FR-LIVE-013 "configure ...
-- without requiring application updates" implies edit-in-place, not an
-- ever-growing history table).
create unique index if not exists idx_live_stream_config_type on live_stream_config (stream_type);

-- ---------------------------------------------------------------------
-- saturday_katha_schedule (FR-LIVE-008) — a single editable "next
-- Saturday Katha" row (Day/Date/Time/Venue per FR-LIVE-008's exact
-- field list). Modelled as a singleton, edited in place each week by an
-- authorized user, rather than a multi-row calendar table: the SRS
-- describes one recurring reminder with concrete Date/Time/Venue
-- fields, not a list of past/future occurrences, and Festival Calendar
-- (a distinct, out-of-scope module per the task brief) is where
-- multi-date scheduling belongs if the SRS ever asks for it there.
-- ---------------------------------------------------------------------
create table if not exists saturday_katha_schedule (
  schedule_id uuid primary key default gen_random_uuid(),
  day_label text not null default 'Saturday',
  event_date date,
  event_time time,
  venue text,
  updated_by text references members (member_id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Singleton, same rationale as live_stream_config.
create unique index if not exists idx_saturday_katha_schedule_singleton on saturday_katha_schedule ((true));

-- ---------------------------------------------------------------------
-- katha_archive (FR-LIVE-010/011/012) — previously uploaded Katha
-- recordings; each an external link (this application never hosts
-- video, SDD 4.5 "Purpose"), soft-deleted on removal (FR-LIVE-012),
-- consistent with the is_deleted convention used by
-- gallery_albums/gallery_photos (migration 0004) and members (migration
-- 0002) rather than a hard DELETE.
-- ---------------------------------------------------------------------
create table if not exists katha_archive (
  archive_id uuid primary key default gen_random_uuid(),
  title text not null,
  katha_date date not null,
  speaker_name text,
  thumbnail_url text,
  watch_url text not null,
  is_deleted boolean not null default false,
  created_by text references members (member_id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references members (member_id)
);

create index if not exists idx_katha_archive_date on katha_archive (katha_date desc);
create index if not exists idx_katha_archive_is_deleted on katha_archive (is_deleted);

-- ---------------------------------------------------------------------
-- Seed rows so getStatus()/getSaturdaySchedule() always have a row to
-- read (empty stream_url / NULL fields render the SRS-specified
-- "unavailable"/"not configured" states — see the live-darshan Edge
-- Function). Without this seed the very first admin configuration call
-- would need a separate INSERT-vs-UPDATE branch; an idempotent seed
-- keeps every write a plain UPDATE, matching FR-LIVE-014 "immediately
-- affect all users" (a single row to update, not create-then-update).
-- ---------------------------------------------------------------------
insert into live_stream_config (stream_type, stream_url, is_live)
select 'darshan', null, false
where not exists (select 1 from live_stream_config where stream_type = 'darshan');

insert into live_stream_config (stream_type, stream_url, is_live)
select 'katha', null, false
where not exists (select 1 from live_stream_config where stream_type = 'katha');

insert into saturday_katha_schedule (day_label, event_date, event_time, venue)
select 'Saturday', null, null, null
where not exists (select 1 from saturday_katha_schedule);

-- ---------------------------------------------------------------------
-- Row Level Security — deny-by-default (SDD 7.2/7.3, SEC-020), same
-- pattern as every other table in this project.
-- ---------------------------------------------------------------------
alter table live_stream_config enable row level security;
alter table saturday_katha_schedule enable row level security;
alter table katha_archive enable row level security;

-- Intentionally NO policies for anon/authenticated: every read (Watch
-- Live Darshan/Katha, View Katha Archive — 10.9, ✅ for every role) and
-- every write (Change Stream Link / Edit Saturday Schedule / Remove
-- Archive — 10.9, restricted) happens through the `live-darshan` Edge
-- Function using the service-role key, which enforces the exact 10.9
-- permission table via the shared PermissionMatrix (`can()`), not RLS
-- policies — identical trust boundary to gallery/announcements/
-- notifications.
