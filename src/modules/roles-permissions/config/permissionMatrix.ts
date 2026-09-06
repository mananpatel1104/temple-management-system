import type { ModuleKey, RoleKey } from '../types/roles.types';

/**
 * Client-side mirror of supabase/functions/_shared/permissionMatrix.ts
 * (SDD 4.2 PermissionMatrix / SRS 7.13). Used ONLY to decide what to
 * show/hide/enable in the UI (SEC-ROLE-002 "hidden menu items shall
 * remain inaccessible even if a user attempts direct navigation" is
 * enforced by the route guards calling the SAME `can()` function below,
 * but the actual authorization decision for every write is always
 * re-checked server-side in the corresponding Edge Function — this file
 * must never be treated as a security boundary by itself.
 *
 * Keep this table's shape identical to the server copy; if the two
 * drift, the UI may offer an action the server correctly rejects
 * (annoying but safe) — never the other way around, since a stricter
 * server can only be less permissive than what it says here.
 */

export const ALL_ROLES: RoleKey[] = [
  'devotee',
  'bhakti_mandal_head',
  'shreeji_yuvak_mandal_head',
  'trustee',
  'supreme_administrator',
];

type ActionTable = Record<string, RoleKey[]>;

export const PERMISSION_MATRIX: Record<ModuleKey, ActionTable> = {
  auth: {
    register: ALL_ROLES,
    editor_login: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'],
    change_own_pin: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'],
    reset_pin: ['supreme_administrator'],
    create_initial_pin: ['supreme_administrator'],
  },
  member_management: {
    view_own_profile: ALL_ROLES,
    view_member_names_directory: ALL_ROLES,
    view_full_member_database: ['supreme_administrator'],
    search_members: ['supreme_administrator'],
    view_mobile_numbers: ['supreme_administrator'],
    view_private_notes: ['supreme_administrator'],
    edit_private_notes: ['supreme_administrator'],
    assign_role: ['supreme_administrator'],
    lock_account: ['supreme_administrator'],
    unlock_account: ['supreme_administrator'],
    suspend_account: ['supreme_administrator'],
    delete_member: ['supreme_administrator'],
    view_role_change_history: ['supreme_administrator'],
  },
  audit_log: {
    view_limited: ['trustee'],
    view_full: ['supreme_administrator'],
    search: ['trustee', 'supreme_administrator'],
    delete_record: ['supreme_administrator'],
  },
  // SRS Chapter 12 / Task 10B. Kept identical to the server copy at
  // supabase/functions/_shared/permissionMatrix.ts — see that file's
  // comments for the full rationale (12.6 responsibility-based
  // creation; Trustee read-only-by-default; Volunteer/Festival/
  // Emergency/General default to Supreme-Administrator-only pending
  // explicit SRS delegation).
  announcements: {
    view: ALL_ROLES,
    create_general: ['supreme_administrator'],
    create_festival: ['supreme_administrator'],
    create_mens: ['shreeji_yuvak_mandal_head', 'supreme_administrator'],
    create_ladies: ['bhakti_mandal_head', 'supreme_administrator'],
    create_volunteer: ['supreme_administrator'],
    create_emergency: ['supreme_administrator'],
    edit_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'],
    delete_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'],
    edit_any: ['supreme_administrator'],
    delete_any: ['supreme_administrator'],
    archive_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'],
    archive_any: ['supreme_administrator'],
    restore: ['supreme_administrator'],
  },
  gallery: {
    view: ALL_ROLES,
    search: ALL_ROLES,
    upload: ['shreeji_yuvak_mandal_head', 'supreme_administrator'],
    create_album: ['supreme_administrator'],
    rename_album: ['supreme_administrator'],
    delete_album: ['supreme_administrator'],
    archive_album: ['supreme_administrator'],
    delete_photo: ['supreme_administrator'],
  },
  library_admin: {
    upload_granth: ['supreme_administrator'],
    update_panchang: ['supreme_administrator'],
    update_nirnay: ['supreme_administrator'],
    view: ALL_ROLES,
  },
  daily_thal: {
    edit: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'],
    view_editor_identity: ['trustee', 'supreme_administrator'],
    view: ALL_ROLES,
  },
  money_manager: {
    create_record: ['supreme_administrator'],
    edit_record: ['supreme_administrator'],
    delete_record: ['supreme_administrator'],
    view_reports: ['trustee', 'supreme_administrator'],
  },
  festival_panchang_nirnay: {
    manage: ['supreme_administrator'],
    view: ALL_ROLES,
  },
  // SRS Chapter 10 — Live Darshan & Katha (Task 10D). Kept identical to
  // the server copy at supabase/functions/_shared/permissionMatrix.ts —
  // see that file's comments for the full 10.9/FR-LIVE-009 rationale.
  live_darshan: {
    view: ALL_ROLES,
    view_saturday_schedule: ['shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'],
    edit_saturday_schedule: ['shreeji_yuvak_mandal_head', 'supreme_administrator'],
    configure_stream: ['supreme_administrator'],
    manage_archive: ['supreme_administrator'],
  },
  settings: {
    edit_own_preferences: ALL_ROLES,
  },
  temple_info: {
    edit: ['supreme_administrator'],
    view: ALL_ROLES,
  },
};

export function can(role: RoleKey | undefined | null, moduleKey: ModuleKey, action: string): boolean {
  if (!role) return false;
  const table = PERMISSION_MATRIX[moduleKey];
  if (!table) return false;
  const allowedRoles = table[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}
