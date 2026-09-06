-- =====================================================================
-- Task 10C — Notifications Module (SRS Chapter 12.10 FR-NOT-001..003,
-- SRS 25.15 BR-047, SDD 4.7 NotificationDispatcher, SDD 5.4 notifications
-- table)
-- =====================================================================
-- Scope: this migration implements notification PERSISTENCE and
-- dispatch-on-publish for Announcements only (FR-NOT-002, BR-047). It
-- deliberately does NOT implement BR-048 (Festival reminders) or BR-049
-- (Daily Thal update notifications) — neither the Festival Calendar nor
-- Daily Thal module exists yet in this codebase, and Task 10C explicitly
-- scopes to "the minimum Announcement integration hook required for
-- notification creation." reference_type intentionally allows for
-- 'festival'/'thal' values (per SDD 5.4's own "Announcement / Festival /
-- Thal" domain) so a future task can dispatch into the same table
-- without a schema change, but no trigger for those sources exists yet.
--
-- SECURITY MODEL — identical trust boundary to migrations 0002/0003/
-- 0004/0005: this project does NOT use Supabase Auth. All reads/writes
-- go through the `notifications` Supabase Edge Function using the
-- SERVICE ROLE key. RLS is enabled with NO permissive policies for
-- anon/authenticated — deny-by-default.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.4 Notifications table (SDD verbatim field list, with one
-- implementation-level adaptation — see reference_id note below)
-- ---------------------------------------------------------------------
-- notification_id: SDD 5.4 specifies VARCHAR(20) as a generic
-- placeholder ID type (same as every other design-level table in SDD
-- Chapter 5). The actual implemented convention for every *content*
-- table added since Task 10A departs from that literal type in favour
-- of `uuid default gen_random_uuid()` (see album_id/photo_id in
-- migration 0004, announcement_id in migration 0005) — only the
-- devotee-facing member_id itself uses the hand-formatted VARCHAR(20)
-- "DEV-00001" scheme (generate_member_id()). notification_id follows
-- that same established uuid convention for consistency with its
-- nearest sibling table (announcements), not a new departure invented
-- here.
--
-- reference_id: SDD specifies VARCHAR(20), matching the *other* SRS/SDD
-- ID formats (e.g. member_id). However SRS 22.6 / migration 0005 define
-- announcements.announcement_id as a UUID (`uuid primary key default
-- gen_random_uuid()`), which does not fit in VARCHAR(20) (36 characters
-- with hyphens). This is a pre-existing inconsistency between the SDD's
-- generic notifications design (written to also cover Festival/Thal,
-- whose IDs are not yet defined anywhere) and the concrete Announcements
-- schema actually implemented in Task 10B — not something invented here.
-- Resolution: reference_id is widened to TEXT (unbounded, NULL-able,
-- same nullability/semantics the SDD specifies) so it can hold an
-- announcements.announcement_id UUID today without truncation, while
-- remaining equally valid for a future VARCHAR(20)-style Festival/Thal
-- id. No FK constraint is added because reference_id is polymorphic
-- across reference_type (SDD 5.4 gives it no FK either) — the
-- Announcement-specific ownership/foreign-key relationship is enforced
-- by the dispatch trigger below, which only ever inserts a real
-- announcements.announcement_id.
create table if not exists notifications (
  notification_id uuid primary key default gen_random_uuid(),
  member_id text not null references members (member_id),
  title varchar(150) not null,
  reference_type text not null check (reference_type in ('announcement', 'festival', 'thal')),
  reference_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_member_id on notifications (member_id);
create index if not exists idx_notifications_member_unread on notifications (member_id, is_read);
create index if not exists idx_notifications_created_at on notifications (created_at desc);
create index if not exists idx_notifications_reference on notifications (reference_type, reference_id);

-- ---------------------------------------------------------------------
-- NotificationDispatcher (SDD 4.7) — eligibility mirror of the
-- VisibilityResolver's visibleCategoriesForRole() in
-- supabase/functions/announcements/index.ts.
--
-- IMPORTANT — SYNC CONTRACT: Postgres triggers cannot invoke the Deno/
-- TypeScript Edge Function code, so this SQL function is a SEPARATE,
-- necessarily-duplicated mirror of that TypeScript switch statement, not
-- a call into it. This is the one place in Task 10C where "do not
-- duplicate visibility rules" cannot be satisfied literally (it is
-- architecturally impossible in this stack without inventing a new
-- cross-process mechanism, which is out of scope). Keep this function's
-- CASE list byte-for-byte equivalent to visibleCategoriesForRole()'s
-- switch statement whenever either changes. As of Task 10C both encode:
--   supreme_administrator -> every category
--   trustee                -> general, festival, emergency, mens, ladies, volunteer
--   shreeji_yuvak_mandal_head -> general, festival, emergency, mens
--   bhakti_mandal_head     -> general, festival, emergency, ladies
--   devotee (and any other/unrecognised role) -> general, festival, emergency
-- 'volunteer' visibility for Trustee only (not Devotee/Bhakti Mandal
-- Head/Shreeji Yuvak Mandal Head) intentionally preserves Task 10B's
-- documented FR-ANN-005 PARTIAL implementation — see that task's final
-- report. No volunteer-group membership model is introduced here.
-- ---------------------------------------------------------------------
create or replace function eligible_role_keys_for_category(p_category text)
returns text[]
language sql
immutable
as $$
  select case p_category
    when 'general'   then array['devotee','bhakti_mandal_head','shreeji_yuvak_mandal_head','trustee','supreme_administrator']
    when 'festival'  then array['devotee','bhakti_mandal_head','shreeji_yuvak_mandal_head','trustee','supreme_administrator']
    when 'emergency' then array['devotee','bhakti_mandal_head','shreeji_yuvak_mandal_head','trustee','supreme_administrator']
    when 'mens'      then array['shreeji_yuvak_mandal_head','trustee','supreme_administrator']
    when 'ladies'    then array['bhakti_mandal_head','trustee','supreme_administrator']
    when 'volunteer' then array['trustee','supreme_administrator']
    else array[]::text[]
  end;
$$;

-- Fans out one notification row per eligible, active member
-- (FR-NOT-002/003, BR-047). Only ever called by the trigger below, with
-- a real announcements row — this is the single write path into
-- notifications for Announcement-sourced rows, so there is exactly one
-- place recipient eligibility is computed for this reference_type.
create or replace function dispatch_announcement_notifications(p_announcement_id uuid)
returns void
language plpgsql
as $$
declare
  v_category text;
  v_title text;
begin
  select category, title into v_category, v_title
    from announcements where announcement_id = p_announcement_id;

  if v_category is null then
    return; -- announcement row not found (should not happen — trigger fires from that row itself)
  end if;

  insert into notifications (member_id, title, reference_type, reference_id)
  select m.member_id, v_title, 'announcement', p_announcement_id::text
    from members m
    join roles r on r.role_id = m.role_id
    where m.account_status = 'active'
      and r.role_key = any (eligible_role_keys_for_category(v_category));
end;
$$;

-- Fires once per announcement, exactly when its status FIRST becomes
-- 'published' — covers both the immediate-publish path (Edge Function
-- INSERT with publish_at <= now) and the pure time-based scheduled
-- path (run_announcement_scheduler()'s UPDATE, migration 0005), since
-- both write through this same table/trigger. Does not re-fire on
-- later edits to an already-published announcement (no OLD row on
-- INSERT; explicit OLD.status check on UPDATE), so editing a published
-- announcement's text does not spam duplicate notifications — SRS does
-- not require re-notification on edit and FR-NOT-002 only speaks to
-- "when a new announcement is published."
create or replace function trg_dispatch_announcement_notifications()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform dispatch_announcement_notifications(new.announcement_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_announcements_notify_on_publish on announcements;
create trigger trg_announcements_notify_on_publish
  after insert or update on announcements
  for each row execute function trg_dispatch_announcement_notifications();

-- ---------------------------------------------------------------------
-- Row Level Security — deny-by-default (SDD 7.2/7.3, SEC-020), same
-- pattern as every other table in this project.
-- ---------------------------------------------------------------------
alter table notifications enable row level security;

-- Intentionally NO policies for anon/authenticated: every read
-- ("Get Notifications" — SRS 23.17) and every write ("Mark as Read" —
-- SRS 23.17) happens through the `notifications` Edge Function using
-- the service-role key, which enforces per-member ownership in
-- application code (see that function's header comment for the
-- Devotee-identity trust-boundary note).
