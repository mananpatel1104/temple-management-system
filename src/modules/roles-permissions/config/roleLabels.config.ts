import type { RoleKey } from '../types/roles.types';

/**
 * Human-readable role labels for the Member Management / Audit Log UI.
 * These are English labels used as a fallback and for admin-facing
 * screens; see i18n `roles.*` keys for the localized versions shown to
 * end users where applicable.
 */
export const ROLE_LABELS: Record<RoleKey, string> = {
  devotee: 'Devotee',
  bhakti_mandal_head: 'Bhakti Mandal Head',
  shreeji_yuvak_mandal_head: 'Shreeji Yuvak Mandal Head',
  trustee: 'Trustee',
  supreme_administrator: 'Supreme Administrator',
};

export const ASSIGNABLE_ROLES: RoleKey[] = [
  'devotee',
  'bhakti_mandal_head',
  'shreeji_yuvak_mandal_head',
  'trustee',
  'supreme_administrator',
];
