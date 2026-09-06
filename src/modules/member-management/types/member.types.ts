import type { RoleKey } from '@modules/roles-permissions/types/roles.types';
import type { SupportedLanguage } from '@config/app.config';

export type AccountStatus = 'active' | 'locked' | 'suspended';

export interface MemberListItem {
  member_id: string;
  full_name: string;
  mobile_number: string | null;
  /** SRS 22.4 — persisted at registration; not sensitive, always returned. */
  preferred_language: SupportedLanguage;
  account_status: AccountStatus;
  registration_date: string;
  last_active_date: string | null;
  role: RoleKey;
  role_name: string;
}

export interface MemberDetail extends Omit<MemberListItem, 'mobile_number'> {
  mobile_number?: string | null;
  private_notes?: string | null;
  must_change_pin: boolean;
  requires_pin: boolean;
}
