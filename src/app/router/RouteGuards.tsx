import { Navigate, Outlet } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import type { ModuleKey } from '@modules/roles-permissions/types/roles.types';
import { HOME_PATH, REGISTRATION_PATH } from './routes.config';

/**
 * Blocks the main app section (Home/Announcements/Gallery/Library/More)
 * until first-launch language selection is complete (FR-AUTH-002).
 * Unselected visitors are sent back to the Welcome Screen at "/".
 */
export function RequireLanguageSelected() {
  const { hasSelectedLanguage } = useLanguage();
  return hasSelectedLanguage ? <Outlet /> : <Navigate to="/" replace />;
}

/**
 * Returning devotees skip the Welcome Screen entirely (SRS: "Returning
 * users are taken directly to the Home Dashboard. No registration screen
 * is shown again.") Redirects straight to Home once language selection
 * is complete; if registration (Task 9) is not yet complete,
 * RequireRegistered (below) catches it and sends the devotee to the
 * Registration Screen instead.
 */
export function RedirectIfLanguageSelected() {
  const { hasSelectedLanguage } = useLanguage();
  return hasSelectedLanguage ? <Navigate to={HOME_PATH} replace /> : <Outlet />;
}

/**
 * FR-AUTH-005: "The registration process does not repeat unless the
 * user logs out, clears application data, or uninstalls." Gates every
 * post-Welcome route on whether a local member identity already exists.
 */
export function RequireRegistered() {
  const { isRegistered } = useAuth();
  return isRegistered ? <Outlet /> : <Navigate to={REGISTRATION_PATH} replace />;
}

/** Registration screen redirects away once a member identity already exists. */
export function RedirectIfRegistered() {
  const { isRegistered } = useAuth();
  return isRegistered ? <Navigate to={HOME_PATH} replace /> : <Outlet />;
}

/**
 * SEC-ROLE-002: "Hidden menu items shall remain inaccessible even if a
 * user attempts direct navigation." Every admin route (Member
 * Management, Audit Log, ...) is wrapped in this guard with the
 * (module, action) it requires; a devotee or under-permissioned editor
 * typing the URL directly is redirected Home rather than seeing the
 * screen render even briefly. This is a UI convenience only — the
 * authoritative check happens again inside the corresponding Edge
 * Function on every request (SEC-ROLE-003).
 */
export function RequirePermission({
  moduleKey,
  action,
}: {
  moduleKey: ModuleKey;
  action: string;
}) {
  const { hasPermission } = useAuth();
  return hasPermission(moduleKey, action) ? <Outlet /> : <Navigate to={HOME_PATH} replace />;
}

/**
 * Audit Log access is granted by EITHER of two distinct permissions
 * (Trustee: view_limited, Supreme Administrator: view_full — 18.8), so
 * it needs its own guard rather than a single RequirePermission action.
 */
export function RequireAuditLogAccess() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('audit_log', 'view_limited') || hasPermission('audit_log', 'view_full');
  return allowed ? <Outlet /> : <Navigate to={HOME_PATH} replace />;
}
