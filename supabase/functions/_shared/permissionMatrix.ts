/**
 * PermissionMatrix (SDD 4.2 / SRS 7.13) — the single authoritative
 * {role, module, action} -> allow/deny table. Every Edge Function must
 * call `can()` from authorization.ts before performing a protected
 * operation; nothing here should ever be trusted client-side alone
 * (SEC-ROLE-001–004, PERM-003).
 *
 * A mirror of this file lives at
 * src/modules/roles-permissions/config/permissionMatrix.ts for UI-level
 * hints (hiding buttons, disabling menu items) — per SDD 4.2 "client and
 * server never drift out of sync" the two are kept identical by
 * convention; THIS file (server-side, Edge Functions) is the one that is
 * actually authoritative and enforced.
 *
 * Modules with concrete controller functionality enforced against real
 * data: auth, member_management, audit_log (Task 9), gallery (Task
 * 10A), announcements (Task 10B). Rows for modules that do not have any
 * implementation yet (daily_thal, money_manager, library_admin,
 * live_darshan, festival_panchang_nirnay) are included so the matrix is
 * complete per SRS 7.13/Chapter 7 and so future tasks only need to wire
 * up controllers against an already-correct policy table — they grant
 * no access today because no code path calls `can()` for them yet.
 */

export type RoleKey =
  | 'devotee'
  | 'bhakti_mandal_head'
  | 'shreeji_yuvak_mandal_head'
  | 'trustee'
  | 'supreme_administrator';

export type ModuleKey =
  | 'auth'
  | 'member_management'
  | 'audit_log'
  | 'announcements'
  | 'gallery'
  | 'library_admin'
  | 'daily_thal'
  | 'money_manager'
  | 'festival_panchang_nirnay'
  | 'live_darshan'
  | 'settings'
  | 'temple_info';

export const ALL_ROLES: RoleKey[] = [
  'devotee',
  'bhakti_mandal_head',
  'shreeji_yuvak_mandal_head',
  'trustee',
  'supreme_administrator',
];

/**
 * Each module maps to the set of actions a role may perform. Absence of
 * a role from an action's array means DENY (PERM-001 least privilege;
 * SRS 7.3 "Higher roles do not automatically inherit ... unless
 * specifically defined").
 */
type ActionTable = Record<string, RoleKey[]>;

export const PERMISSION_MATRIX: Record<ModuleKey, ActionTable> = {
  // SRS Chapter 6/14 — Authentication
  auth: {
    register: ['devotee', 'bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'], // anyone may self-register as a Devotee (FR-AUTH-001)
    editor_login: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'], // ROLE-D-001 "no PIN required" — devotees never authenticate
    change_own_pin: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'], // FR-MEM-009
    reset_pin: ['supreme_administrator'], // FR-MEM-010 / FR-AUTH-010 — no self-service reset
    create_initial_pin: ['supreme_administrator'], // FR-AUTH-006
  },

  // SRS Chapter 13 — Member Management
  member_management: {
    view_own_profile: ['devotee', 'bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'],
    view_member_names_directory: ['devotee', 'bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'], // FR-MEM-003 (name only)
    view_full_member_database: ['supreme_administrator'], // FR-MEM-005
    search_members: ['supreme_administrator'], // FR-MEM-011
    view_mobile_numbers: ['supreme_administrator'], // FR-MEM-003
    view_private_notes: ['supreme_administrator'], // FR-MEM-004
    edit_private_notes: ['supreme_administrator'], // FR-MEM-012
    assign_role: ['supreme_administrator'], // FR-MEM-006 / PERM-006
    lock_account: ['supreme_administrator'],
    unlock_account: ['supreme_administrator'], // account_status Locked — 13.9
    suspend_account: ['supreme_administrator'],
    delete_member: ['supreme_administrator'], // FR-MEM-015
    view_role_change_history: ['supreme_administrator'], // FR-MEM-014
  },

  // SRS Chapter 18 — Audit Log
  audit_log: {
    view_limited: ['trustee'], // 18.8 — Activity, User Name, Date, Time only
    view_full: ['supreme_administrator'], // 18.8 — full record incl. previous/new values, PIN ops
    search: ['trustee', 'supreme_administrator'], // FR-AUDIT-003 (Trustee limited to what view_limited exposes)
    delete_record: ['supreme_administrator'], // FR-AUDIT-009, exceptional only
  },

  // SRS Chapter 12 — Announcement Module (Task 10B). Completes the
  // previously forward-declared rows.
  //
  // 12.6 "Announcement Editor Permissions" is explicit that creation is
  // per-responsibility, not per-hierarchy: Supreme Administrator may
  // create every category; Shreeji Yuvak Mandal Head only Men's;
  // Bhakti Mandal Head only Ladies. Festival/General/Volunteer/
  // Emergency are not delegated to either Mandal Head anywhere in the
  // SRS, so they default to Supreme-Administrator-only (safe default;
  // documented in the Task 10B final report).
  //
  // 12.6 also states plainly: "Trustee has read-only access unless
  // additional permissions are granted." There is no per-member
  // "additional permission grant" mechanism anywhere in the current
  // schema/SRS, so — correcting the earlier forward-declared stub,
  // which had incorrectly included Trustee in create_mens/create_ladies
  // — Trustee is read-only by default across every create/edit/delete/
  // archive/restore action below. FR-ANN-003/004 still correctly grant
  // Trustee *visibility* into Men's/Ladies announcements (a separate
  // concern, enforced by VisibilityResolver in the Edge Function, not
  // by this create/edit matrix).
  announcements: {
    view: ALL_ROLES, // 12.15 "View Announcements" ✅ for every role, including Devotee (no PIN/session required)
    create_general: ['supreme_administrator'],
    create_festival: ['supreme_administrator'],
    create_mens: ['shreeji_yuvak_mandal_head', 'supreme_administrator'], // 12.6
    create_ladies: ['bhakti_mandal_head', 'supreme_administrator'], // 12.6
    // FR-ANN-005 targets a "volunteer group" — no volunteer-group
    // membership table exists yet (Volunteer Management is an explicit
    // *future* enhancement per SRS), so Volunteer creation defaults to
    // Supreme-Administrator-only pending that future module.
    create_volunteer: ['supreme_administrator'],
    create_emergency: ['supreme_administrator'], // highest-severity category — SA only by default
    edit_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'], // 12.15 "Edit Own Announcement"
    delete_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'], // 12.15 "Delete Own Announcement"
    edit_any: ['supreme_administrator'],
    delete_any: ['supreme_administrator'],
    archive_own: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'], // 12.15 "Archive Announcement"
    archive_any: ['supreme_administrator'],
    restore: ['supreme_administrator'], // 12.15 "Restore Announcement" — SA only
  },

  // SRS Chapter 11 — Gallery (Task 10A)
  gallery: {
    view: ALL_ROLES, // 11.17 "View Gallery" — no PIN required, matches devotees never authenticating
    search: ALL_ROLES, // FR-GAL-017 / 11.17 "Search Photos"
    upload: ['shreeji_yuvak_mandal_head', 'supreme_administrator'], // 11.9 / FR-GAL-016 "upload photos, upload Daily Darshan, add photos to existing albums"
    create_album: ['supreme_administrator'], // FR-GAL-015 — Festival/Sabha/Event albums only; Daily Darshan is a seeded singleton
    rename_album: ['supreme_administrator'], // FR-GAL-015
    delete_album: ['supreme_administrator'], // FR-GAL-015 (soft delete — SDD 5.5)
    archive_album: ['supreme_administrator'], // FR-GAL-015
    delete_photo: ['supreme_administrator'], // FR-GAL-015 "move photos within, and archive albums" — photo removal is SA-only; FR-GAL-016 does not grant Shreeji Yuvak Mandal Head deletion rights
  },

  // Forward-declared for future tasks (SRS Chapter 9)
  library_admin: {
    upload_granth: ['supreme_administrator'], // FR-LIB-011
    update_panchang: ['supreme_administrator'], // FR-LIB-002
    update_nirnay: ['supreme_administrator'], // FR-LIB-003
    view: ALL_ROLES,
  },

  // Forward-declared for future tasks (SRS Chapter 17)
  daily_thal: {
    edit: ['bhakti_mandal_head', 'shreeji_yuvak_mandal_head', 'supreme_administrator'],
    view_editor_identity: ['trustee', 'supreme_administrator'], // FR-THAL-004 / FR-AUDIT-005
    view: ALL_ROLES,
  },

  // Forward-declared for future tasks (SRS Chapter 15)
  money_manager: {
    create_record: ['supreme_administrator'],
    edit_record: ['supreme_administrator'],
    delete_record: ['supreme_administrator'],
    view_reports: ['trustee', 'supreme_administrator'],
  },

  // Forward-declared for future tasks (SRS Chapter 16)
  festival_panchang_nirnay: {
    manage: ['supreme_administrator'],
    view: ALL_ROLES,
  },

  // SRS Chapter 10 — Live Darshan & Katha (Task 10D). Actions map
  // 1:1 onto the 10.9 permission table rows:
  //   Watch Live Darshan / Watch Live Katha / View Katha Archive -> view
  //   Edit Saturday Schedule                  -> edit_saturday_schedule
  //   Change Stream Link                      -> configure_stream
  //   Remove Archive (+ create, same row: FR-LIVE-012 "may archive or
  //     remove outdated recordings" grants both to the same role)
  //                                            -> manage_archive
  // view_saturday_schedule is not a 10.9 table row — it implements the
  // separate visibility rule at FR-LIVE-009 ("hidden from other users"),
  // which 10.9 does not restate since it only tables Watch/Edit-type
  // actions, not read-visibility-by-role.
  live_darshan: {
    view: ALL_ROLES,
    view_saturday_schedule: ['shreeji_yuvak_mandal_head', 'trustee', 'supreme_administrator'], // FR-LIVE-009
    edit_saturday_schedule: ['shreeji_yuvak_mandal_head', 'supreme_administrator'], // 10.9 "Edit Saturday Schedule"
    configure_stream: ['supreme_administrator'], // 10.9 "Change Stream Link"
    manage_archive: ['supreme_administrator'], // 10.9 "Remove Archive" + FR-LIVE-012 "archive"
  },

  // SRS Chapter 19 (own preferences only — every role may edit their own settings)
  settings: {
    edit_own_preferences: ALL_ROLES,
  },

  // Forward-declared for future tasks (SRS 19.9 About/Contact)
  temple_info: {
    edit: ['supreme_administrator'],
    view: ALL_ROLES,
  },
};

/**
 * Authoritative allow/deny check (SDD "AuthorizationService.can").
 * Deny-by-default: an unknown module/action/role combination is always
 * denied rather than throwing, so a typo in calling code fails closed.
 */
export function can(role: RoleKey, module: ModuleKey, action: string): boolean {
  const table = PERMISSION_MATRIX[module];
  if (!table) return false;
  const allowedRoles = table[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}
