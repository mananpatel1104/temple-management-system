import { functionsClient } from '@shared/lib/functionsClient';
import type { RoleKey } from '@modules/roles-permissions/types/roles.types';
import { sessionStore } from './sessionStore';
import type {
  EditorLoginRequest,
  EditorLoginResponse,
  EditorSession,
  RegisterRequest,
  RegisterResponse,
  StoredMember,
} from '../types/auth.types';

/**
 * AuthController-equivalent client service (SDD 4.1). Every method here
 * is a thin, typed wrapper over an Edge Function — no business logic
 * (validation, hashing, lockout, RBAC) is duplicated on the client;
 * that all lives server-side per SEC-ROLE-001–004.
 */
export const authService = {
  /** FR-AUTH-003/004/005 — first-launch registration. */
  async register(request: RegisterRequest): Promise<StoredMember> {
    const data = await functionsClient.post<RegisterResponse>('auth-register', request);
    const member: StoredMember = {
      memberId: data.member_id,
      fullName: data.full_name,
      mobileNumber: data.mobile_number,
      preferredLanguage: data.preferred_language,
      role: data.role,
      registrationDate: data.registration_date,
    };
    sessionStore.setMember(member);
    return member;
  },

  /** FR-AUTH-006/007 — editor login by Name + PIN. */
  async loginEditor(request: EditorLoginRequest): Promise<EditorSession> {
    const data = await functionsClient.post<EditorLoginResponse>('auth-login', request);
    const session: EditorSession = {
      memberId: data.member_id,
      fullName: data.full_name,
      role: data.role,
      roleName: data.role_name,
      mustChangePin: data.must_change_pin,
      sessionToken: data.session_token,
      expiresAt: data.expires_at,
    };
    sessionStore.setEditorSession(session);
    return session;
  },

  /** FR-MEM-009 — editor changes their own PIN. */
  async changeOwnPin(currentPin: string, newPin: string): Promise<void> {
    const session = sessionStore.getEditorSession();
    if (!session) throw new Error('No active editor session.');
    await functionsClient.put<null>(
      'auth-change-pin',
      { currentPin, newPin },
      session.sessionToken,
    );
  },

  /**
   * FR-6.7 "Editors may choose to exit Editor Mode. After exiting,
   * administrative menus disappear and the application returns to
   * devotee mode." — this does not touch the devotee's own
   * registration/member identity, only the editor session.
   */
  exitEditorMode(): void {
    sessionStore.clearEditorSession();
  },

  /**
   * Full logout (SRS 6.7/19 Logout item): clears BOTH the editor
   * session and the local member identity, which is what makes the
   * Welcome/Registration screen reappear on next launch, per
   * FR-AUTH-005 ("does not repeat unless the user logs out...").
   */
  logout(): void {
    sessionStore.clearEditorSession();
    sessionStore.clearMember();
  },

  getStoredMember(): StoredMember | null {
    return sessionStore.getMember();
  },

  getEditorSession(): EditorSession | null {
    return sessionStore.getEditorSession();
  },

  isEditorRole(role: RoleKey): boolean {
    return role !== 'devotee';
  },
};
