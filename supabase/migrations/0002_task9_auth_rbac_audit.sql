-- =====================================================================
-- Task 9 — Authentication, Member Registration, RBAC & Audit Foundation
-- =====================================================================
-- Implements the schema required by:
--   SRS Chapter 6  (User Management & Authentication)
--   SRS Chapter 7  (Roles, Permissions & Access Control)
--   SRS Chapter 13 (Member Management)
--   SRS Chapter 14 (Authentication, PIN Management & Security)
--   SRS Chapter 18 (Audit Log & Activity History)
--   SRS Chapter 22 (Database Design Specification — 22.4, 22.5, 22.18)
--   SDD  4.1, 4.2, 4.8, 4.12, 5.3, 5.5, 7.1–7.5
--
-- SECURITY MODEL (SDD 2.5 / 7.1 / MASTER_CONTEXT):
--   This project does NOT use Supabase Auth. All privileged reads/writes
--   go through Supabase Edge Functions (supabase/functions/*) using the
--   SERVICE ROLE key, which is only ever available server-side (Edge
--   Function secrets), never shipped to the client. The client's anon
--   key can therefore never read or write these tables directly — Row
--   Level Security is enabled with NO permissive policies for the
--   `anon`/`authenticated` roles, which is a hard "deny by default".
--   The service role bypasses RLS by Postgres/Supabase design, which is
--   exactly the trust boundary described in SDD 7.2/7.3.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
-- pgcrypto gives us crypt()/gen_salt() so PINs can be hashed with
-- bcrypt ("bf") entirely inside Postgres — the hash never has to be
-- computed or compared in application code, so a hash value is never
-- something an Edge Function needs to know how to interpret (SEC-005 /
-- SDD 7.1 "PINs are hashed ... never stored or logged in plain text").
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 22.5 Roles table
-- ---------------------------------------------------------------------
-- The five roles are exactly those defined in SRS 6.3/Chapter 7 and SDD
-- 4.1/4.2. role_key is the stable machine identifier used throughout the
-- application code and the permission matrix; role_name is the
-- human-readable label shown in the UI/audit log.
create table if not exists roles (
  role_id serial primary key,
  role_key text not null unique
    check (role_key in (
      'devotee',
      'bhakti_mandal_head',
      'shreeji_yuvak_mandal_head',
      'trustee',
      'supreme_administrator'
    )),
  role_name text not null,
  requires_pin boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

insert into roles (role_key, role_name, requires_pin, description) values
  ('devotee', 'Devotee', false,
    'Default role for every registered user. View-only access, no PIN required (SRS 7.4).'),
  ('bhakti_mandal_head', 'Bhakti Mandal Head', true,
    'Manages ladies announcements, Bhakti Mandal member list and Daily Thal (SRS 7.5).'),
  ('shreeji_yuvak_mandal_head', 'Shreeji Yuvak Mandal Head', true,
    'Manages men''s announcements, Daily Darshan, Gallery uploads and Daily Thal (SRS 7.6).'),
  ('trustee', 'Trustee', true,
    'Oversight role: financial reports, Daily Thal history, permitted audit records (SRS 7.7).'),
  ('supreme_administrator', 'Supreme Administrator', true,
    'Unrestricted authority over the entire application (SRS 7.8).')
on conflict (role_key) do nothing;

-- ---------------------------------------------------------------------
-- 22.4 Members table
-- ---------------------------------------------------------------------
-- FR-MEM-002 / FR-AUTH-004 specify a permanent, sequential, human
-- readable Member ID such as DEV-00001. member_seq drives the numeric
-- suffix; generate_member_id() (below) formats it.
create sequence if not exists member_id_seq start with 1;

create table if not exists members (
  member_id text primary key,
  full_name text not null check (char_length(btrim(full_name)) > 0),
  mobile_number text,
  role_id integer not null references roles (role_id),
  -- PIN handling (FR-AUTH/FR-MEM/SEC-005): only ever a bcrypt hash,
  -- generated with pin_hash() and checked with pin_verify() below.
  -- NULL for Devotees, who never receive a PIN.
  pin_hash text,
  pin_last_changed_at timestamptz,
  must_change_pin boolean not null default false,
  failed_pin_attempts integer not null default 0,
  -- Account Status (SRS 13.9): Active | Locked | Suspended
  account_status text not null default 'active'
    check (account_status in ('active', 'locked', 'suspended')),
  locked_at timestamptz,
  -- Private notes (FR-MEM-012): visible only to the Supreme
  -- Administrator — enforced in member-management Edge Function, never
  -- returned to any other role.
  private_notes text,
  registration_date timestamptz not null default now(),
  last_active_date timestamptz,
  -- FR-MEM-015/016: deletion is soft. The row (and the historical
  -- contributor name it represents) is preserved forever; it is only
  -- excluded from normal directory/search results and can no longer
  -- register a session. This also avoids a foreign-key deadlock: every
  -- member accrues audit_logs / role_change_history references almost
  -- immediately, which a hard DELETE would violate.
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by text references members (member_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_full_name on members (lower(full_name));
create index if not exists idx_members_mobile on members (mobile_number);
create index if not exists idx_members_role on members (role_id);
create index if not exists idx_members_status on members (account_status);
create index if not exists idx_members_is_deleted on members (is_deleted);

create or replace function generate_member_id()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('member_id_seq');
  return 'DEV-' || lpad(next_val::text, 5, '0');
end;
$$;

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_members_updated_at on members;
create trigger trg_members_updated_at
  before update on members
  for each row execute function touch_updated_at();

-- PIN hashing helpers (SEC-005 / SDD 4.1 PinHasher) -------------------
create or replace function pin_hash(plain_pin text)
returns text
language sql
as $$
  select crypt(plain_pin, gen_salt('bf', 10));
$$;

create or replace function pin_verify(plain_pin text, stored_hash text)
returns boolean
language sql
as $$
  select stored_hash is not null and stored_hash = crypt(plain_pin, stored_hash);
$$;

-- ---------------------------------------------------------------------
-- 5.3 role_change_history table (FR-MEM-014)
-- ---------------------------------------------------------------------
create table if not exists role_change_history (
  history_id bigserial primary key,
  member_id text not null references members (member_id),
  previous_role_id integer references roles (role_id),
  new_role_id integer not null references roles (role_id),
  changed_by text not null references members (member_id),
  changed_at timestamptz not null default now()
);

create index if not exists idx_role_history_member on role_change_history (member_id);

-- ---------------------------------------------------------------------
-- 22.18 Audit Logs table (Chapter 18)
-- ---------------------------------------------------------------------
create table if not exists audit_logs (
  audit_id bigserial primary key,
  module text not null,              -- e.g. 'Authentication', 'Member Management'
  action text not null,               -- e.g. 'PIN_RESET', 'ROLE_CHANGE', 'ACCOUNT_LOCK'
  category text not null default 'System Administration'
    check (category in (
      'Authentication', 'Member Management', 'Gallery', 'Library',
      'Announcements', 'Daily Thal', 'Financial Records', 'Panchang',
      'Nirnay', 'Festival Calendar', 'System Administration'
    )),
  performed_by text references members (member_id),
  performed_by_name text not null,    -- denormalised so history reads correctly even if the member is later removed
  performed_by_role text not null,
  target_member_id text references members (member_id),
  previous_value jsonb,
  new_value jsonb,
  remarks text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_audit_timestamp on audit_logs (timestamp desc);
create index if not exists idx_audit_module on audit_logs (module);
create index if not exists idx_audit_performed_by on audit_logs (performed_by);
create index if not exists idx_audit_category on audit_logs (category);

-- FR-AUDIT-009 — deleting an audit record must itself create a new audit
-- entry. Ordinary DELETE is blocked entirely (data-integrity + 18.15
-- "cannot be edited by ordinary users"); the audit-log Edge Function
-- performs the Supreme-Administrator-only exceptional deletion by first
-- writing the "AUDIT_RECORD_DELETED" entry and only then deleting the
-- target row, both inside one transaction.

-- ---------------------------------------------------------------------
-- Row Level Security — deny-by-default (SDD 7.2/7.3, SEC-ROLE series)
-- ---------------------------------------------------------------------
alter table roles enable row level security;
alter table members enable row level security;
alter table role_change_history enable row level security;
alter table audit_logs enable row level security;

-- Intentionally NO policies are created for anon/authenticated: every
-- read and write happens through Edge Functions using the service-role
-- key, which bypasses RLS by design. This means even a leaked anon key
-- cannot read a single member row, PIN hash, or audit entry.

-- ---------------------------------------------------------------------
-- Bootstrap safety valve
-- ---------------------------------------------------------------------
-- FR: "Supreme Administrator bootstrap" (Task 9 §4). There is no
-- self-service path to create the first Supreme Administrator (SDD
-- 12.1 Assumption). This helper is used ONLY by the bootstrap-admin
-- Edge Function, which itself requires a one-time deployment secret
-- (BOOTSTRAP_SETUP_TOKEN) and refuses to run if a Supreme Administrator
-- already exists.
create or replace function supreme_administrator_exists()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from members m
    join roles r on r.role_id = m.role_id
    where r.role_key = 'supreme_administrator'
  );
$$;
