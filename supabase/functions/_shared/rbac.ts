import { resolveSession, type SessionClaims } from './jwt.ts';
import { can, type ModuleKey } from './permissionMatrix.ts';
import { jsonError } from './response.ts';
import { getSupabaseAdmin } from './supabaseAdmin.ts';

/**
 * Resolves the Bearer session token to a live member row and re-checks
 * account_status on every call (SEC-ROLE-003: "every administrative
 * action shall be validated ... before execution" — a session issued
 * before a Lock/Suspend must stop working immediately, not just at next
 * login). Returns null (caller should respond 401) if there is no valid
 * session, and 'locked'/'suspended' string if the account state no
 * longer permits editor actions.
 */
export async function requireEditorSession(req: Request): Promise<
  | { ok: true; claims: SessionClaims; roleKey: string }
  | { ok: false; reason: 'unauthenticated' | 'account_not_active' }
> {
  const claims = await resolveSession(req);
  if (!claims) return { ok: false, reason: 'unauthenticated' };

  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from('members')
    .select('account_status, roles(role_key)')
    .eq('member_id', claims.sub)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const roleKey = (member as any)?.roles?.role_key as string | undefined;

  if (!member || member.account_status !== 'active' || !roleKey) {
    return { ok: false, reason: 'account_not_active' };
  }

  return { ok: true, claims, roleKey };
}

/**
 * Like requireEditorSession, but for endpoints that are PUBLIC reads
 * (no session required at all — e.g. Announcements "View", which is ✅
 * for Devotee/every role per SRS 12.15) yet still want to know WHICH
 * role is asking, if any, so they can widen what they return for an
 * authenticated editor (VisibilityResolver — SDD 4.7). Never throws and
 * never returns an error Response; a missing/invalid/expired token or a
 * locked/suspended account simply resolves to null, i.e. "treat this
 * request the same as an anonymous Devotee".
 */
export async function resolveOptionalEditorRole(
  req: Request,
): Promise<{ roleKey: string; memberId: string } | null> {
  const session = await requireEditorSession(req);
  if (!session.ok) return null;
  return { roleKey: session.roleKey, memberId: session.claims.sub };
}

/**
 * Convenience wrapper: requires a valid editor session AND that its role
 * is permitted the given (module, action) per the PermissionMatrix.
 * Returns a ready-to-return 401/403 Response on failure, or the
 * resolved session/roleKey on success.
 */
export async function requirePermission(
  req: Request,
  moduleKey: ModuleKey,
  action: string,
): Promise<
  | { granted: true; claims: SessionClaims; roleKey: string }
  | { granted: false; response: Response }
> {
  const session = await requireEditorSession(req);
  if (!session.ok) {
    return {
      granted: false,
      response:
        session.reason === 'unauthenticated'
          ? jsonError('Authentication required.', '401')
          : jsonError(
              'This account is locked or suspended. Contact the Supreme Administrator.',
              '403',
            ),
    };
  }

  if (!can(session.roleKey as never, moduleKey, action)) {
    return {
      granted: false,
      response: jsonError(
        'You do not have permission to perform this action.',
        '403',
      ),
    };
  }

  return { granted: true, claims: session.claims, roleKey: session.roleKey };
}
