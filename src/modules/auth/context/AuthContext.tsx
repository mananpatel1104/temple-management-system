import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ModuleKey, RoleKey } from '@modules/roles-permissions/types/roles.types';
import { authorizationService } from '@modules/roles-permissions/services/authorizationService';
import { authService } from '../services/authService';
import type {
  EditorLoginRequest,
  EditorSession,
  RegisterRequest,
  StoredMember,
} from '../types/auth.types';

interface AuthContextValue {
  /** The registered devotee identity (null until FR-AUTH-003/004/005 registration completes). */
  member: StoredMember | null;
  /** The active PIN-authenticated editor session, if any (FR-AUTH-007). */
  editorSession: EditorSession | null;
  /** True once registration is complete — drives the onboarding route guard. */
  isRegistered: boolean;
  /** True while an editor is currently PIN-authenticated ("Editor Mode"). */
  isEditorMode: boolean;
  /** The effective role for permission checks: the editor session's role while in Editor Mode, otherwise the registered member's (always 'devotee'). */
  effectiveRole: RoleKey | null;
  register: (request: RegisterRequest) => Promise<StoredMember>;
  loginEditor: (request: EditorLoginRequest) => Promise<EditorSession>;
  exitEditorMode: () => void;
  logout: () => void;
  hasPermission: (moduleKey: ModuleKey, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<StoredMember | null>(() =>
    authService.getStoredMember(),
  );
  const [editorSession, setEditorSession] = useState<EditorSession | null>(() =>
    authService.getEditorSession(),
  );

  const register = useCallback(async (request: RegisterRequest) => {
    const stored = await authService.register(request);
    setMember(stored);
    return stored;
  }, []);

  const loginEditor = useCallback(async (request: EditorLoginRequest) => {
    const session = await authService.loginEditor(request);
    setEditorSession(session);
    return session;
  }, []);

  const exitEditorMode = useCallback(() => {
    authService.exitEditorMode();
    setEditorSession(null);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setEditorSession(null);
    setMember(null);
  }, []);

  const effectiveRole: RoleKey | null = editorSession?.role ?? member?.role ?? null;

  const hasPermission = useCallback(
    (moduleKey: ModuleKey, action: string) =>
      authorizationService.can(effectiveRole, moduleKey, action),
    [effectiveRole],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      member,
      editorSession,
      isRegistered: member !== null,
      isEditorMode: editorSession !== null,
      effectiveRole,
      register,
      loginEditor,
      exitEditorMode,
      logout,
      hasPermission,
    }),
    [member, editorSession, effectiveRole, register, loginEditor, exitEditorMode, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
