import type { EditorSession, StoredMember } from '../types/auth.types';

/**
 * SessionStore (SDD 4.1 Table 3). Two independent pieces of state:
 *
 *  - MEMBER_KEY: the devotee's permanent local identity, written once
 *    at registration (FR-AUTH-005) and read on every launch so
 *    "registration does not repeat unless the user logs out, clears
 *    application data, or uninstalls" (FR-AUTH-005) and "returning
 *    users are taken directly to the Home Dashboard" (6.4). This is
 *    NOT a security boundary — it is a devotee's own convenience
 *    identity, exactly like the SRS describes (no PIN, no login).
 *
 *  - SESSION_KEY: the short-lived editor session token (FR-AUTH-007).
 *    Kept in localStorage (not sessionStorage) so an editor mid-task
 *    surviving a reload doesn't lose their unlocked state before the
 *    token's own 15-minute expiry — but every read here also checks
 *    expiry, and the authoritative check happens server-side on every
 *    Edge Function call regardless (SEC-ROLE-003).
 *
 * Entirely synchronous/local so it works fully offline (SRS 6.7
 * "General devotees normally remain logged in").
 */

const MEMBER_KEY = 'ssm.member';
const SESSION_KEY = 'ssm.editorSession';

export const sessionStore = {
  getMember(): StoredMember | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(MEMBER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredMember;
    } catch {
      return null;
    }
  },

  setMember(member: StoredMember): void {
    window.localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
  },

  clearMember(): void {
    window.localStorage.removeItem(MEMBER_KEY);
  },

  getEditorSession(): EditorSession | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as EditorSession;
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        window.localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  setEditorSession(session: EditorSession): void {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  clearEditorSession(): void {
    window.localStorage.removeItem(SESSION_KEY);
  },
};
