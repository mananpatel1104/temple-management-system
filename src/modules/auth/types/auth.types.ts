import type { RoleKey } from '@modules/roles-permissions/types/roles.types';
import type { SupportedLanguage } from '@config/app.config';

/** The devotee/member identity persisted locally after registration (FR-AUTH-005). */
export interface StoredMember {
  memberId: string;
  fullName: string;
  mobileNumber: string | null;
  /** SRS 22.4 — persisted from the Welcome Screen's language-selection flow at registration. */
  preferredLanguage: SupportedLanguage;
  role: RoleKey;
  registrationDate: string;
}

/** An active editor session (FR-AUTH-007, SDD 4.1 SessionStore). */
export interface EditorSession {
  memberId: string;
  fullName: string;
  role: RoleKey;
  roleName: string;
  mustChangePin: boolean;
  sessionToken: string;
  expiresAt: string;
}

export interface RegisterRequest {
  fullName: string;
  mobileNumber?: string;
  /** Required — comes from the existing Welcome Screen language-selection flow, never a second picker. */
  preferredLanguage: SupportedLanguage;
}

export interface RegisterResponse {
  member_id: string;
  full_name: string;
  mobile_number: string | null;
  preferred_language: SupportedLanguage;
  role: RoleKey;
  registration_date: string;
}

export interface EditorLoginRequest {
  fullName: string;
  pin: string;
}

export interface EditorLoginResponse {
  member_id: string;
  full_name: string;
  role: RoleKey;
  role_name: string;
  must_change_pin: boolean;
  session_token: string;
  expires_at: string;
}
