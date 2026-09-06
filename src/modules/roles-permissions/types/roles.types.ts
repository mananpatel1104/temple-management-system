/**
 * RBAC types (SRS Chapter 7 / SDD 4.2). Kept in exact lockstep with the
 * server-side matrix at
 * supabase/functions/_shared/permissionMatrix.ts — the server copy is
 * authoritative (SEC-ROLE series); this one drives UI-level hints only
 * (hiding/disabling actions a role could never perform), never the
 * final decision.
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

export interface RoleDefinition {
  key: RoleKey;
  requiresPin: boolean;
}

export const ROLE_HIERARCHY: RoleKey[] = [
  'supreme_administrator',
  'trustee',
  'shreeji_yuvak_mandal_head',
  'bhakti_mandal_head',
  'devotee',
];

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  devotee: { key: 'devotee', requiresPin: false },
  bhakti_mandal_head: { key: 'bhakti_mandal_head', requiresPin: true },
  shreeji_yuvak_mandal_head: { key: 'shreeji_yuvak_mandal_head', requiresPin: true },
  trustee: { key: 'trustee', requiresPin: true },
  supreme_administrator: { key: 'supreme_administrator', requiresPin: true },
};

export function roleRequiresPin(role: RoleKey): boolean {
  return ROLE_DEFINITIONS[role].requiresPin;
}
