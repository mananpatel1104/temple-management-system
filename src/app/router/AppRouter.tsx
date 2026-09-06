import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '@app/layout/RootLayout';
import { MainLayout } from '@app/layout/MainLayout';
import { NotFoundScreen } from '@app/layout/NotFoundScreen';
import { WelcomeScreen } from '@app/onboarding/WelcomeScreen';
import { RegistrationScreen } from '@app/onboarding/RegistrationScreen';
import { LibraryCategoryScreen } from '@modules/library/pages/LibraryCategoryScreen';
import { GalleryAlbumListScreen } from '@modules/gallery/pages/GalleryAlbumListScreen';
import { GalleryAlbumDetailScreen } from '@modules/gallery/pages/GalleryAlbumDetailScreen';
import { AnnouncementDetailScreen } from '@modules/announcements/pages/AnnouncementDetailScreen';
import { NotificationsScreen } from '@modules/notifications/pages/NotificationsScreen';
import { LiveDarshanScreen } from '@modules/live-darshan/pages/LiveDarshanScreen';
import { EditorLoginScreen } from '@modules/auth/pages/EditorLoginScreen';
import { MemberManagementScreen } from '@modules/member-management/pages/MemberManagementScreen';
import { AuditLogScreen } from '@modules/audit-log/pages/AuditLogScreen';
import {
  RequireLanguageSelected,
  RedirectIfLanguageSelected,
  RequireRegistered,
  RedirectIfRegistered,
  RequirePermission,
  RequireAuditLogAccess,
} from './RouteGuards';
import { appRoutes, REGISTRATION_PATH, EDITOR_LOGIN_PATH, MEMBER_MANAGEMENT_PATH, AUDIT_LOG_PATH } from './routes.config';

/**
 * Route tree (SRS Chapter 6 Welcome/Language/Registration flow + SRS
 * 24.8 Bottom Navigation Bar; SDD 8.1 Component Hierarchy):
 *
 *   /                    -> WelcomeScreen (redirects to /home once
 *                           language selection is already complete)
 *   /register            -> RegistrationScreen (Task 9, FR-AUTH-003+),
 *                           language-gated; redirects to /home once a
 *                           member identity already exists.
 *   /editor-login         -> EditorLoginScreen (Task 9, FR-AUTH-006+),
 *                           requires registration to be complete first.
 *   /home, /announcements,
 *   /gallery, /library,
 *   /more                -> MainLayout, gated on language selection AND
 *                           registration (Task 9: RequireRegistered).
 *   /library/:categoryId -> MainLayout -> LibraryCategoryScreen
 *   /gallery/:albumType  -> MainLayout -> GalleryAlbumListScreen (Task
 *                           10A; Festival/Sabha/Event album listing)
 *   /gallery/album/:albumId -> MainLayout -> GalleryAlbumDetailScreen
 *                           (Task 10A; photo grid + full-screen viewer)
 *   /announcements/:id    -> MainLayout -> AnnouncementDetailScreen
 *                           (Task 10B; full announcement + edit/archive/
 *                           restore/delete controls where permitted)
 *   /notifications        -> MainLayout -> NotificationsScreen (Task
 *                           10C; reached via the TopBar bell icon, not
 *                           a Bottom Navigation Bar tab — SRS 24.8 fixes
 *                           that tab set)
 *   /live-darshan          -> MainLayout -> LiveDarshanScreen (Task 10D,
 *                           SRS Chapter 10): not a Bottom Navigation Bar
 *                           tab either (SRS 24.8), reached from the Home
 *                           Dashboard's Live Darshan Card. Public read
 *                           within MainLayout — RBAC (Saturday Schedule
 *                           visibility, stream configuration, archive
 *                           management) is enforced inside the
 *                           `live-darshan` Edge Function, not by this
 *                           route.
 *   /member-management    -> MainLayout -> MemberManagementScreen,
 *                           additionally gated by RequirePermission
 *                           (member_management, search_members) —
 *                           Supreme Administrator only (SRS Chapter 13).
 *   /audit-log            -> MainLayout -> AuditLogScreen, gated by
 *                           RequirePermission(audit_log, view_limited)
 *                           — Trustee (limited) or Supreme Administrator
 *                           (full), per 18.8.
 *   *                    -> NotFoundScreen
 */
export function AppRouter() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route element={<RedirectIfLanguageSelected />}>
            <Route index element={<WelcomeScreen />} />
          </Route>

          <Route element={<RequireLanguageSelected />}>
            <Route element={<RedirectIfRegistered />}>
              <Route path={REGISTRATION_PATH.slice(1)} element={<RegistrationScreen />} />
            </Route>

            <Route element={<RequireRegistered />}>
              <Route path={EDITOR_LOGIN_PATH.slice(1)} element={<EditorLoginScreen />} />

              <Route element={<MainLayout />}>
                {appRoutes.map(({ path, component: Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
                <Route path="library/:categoryId" element={<LibraryCategoryScreen />} />
                {/* Gallery Module (Task 10A, SRS Chapter 11): album listing for the
                    user-created categories (Festival/Sabha/Event) and album detail
                    (all categories, including the Daily Darshan singleton). Both are
                    public reads within MainLayout, same as the Gallery Home tab
                    itself — RBAC is enforced inside the `gallery` Edge Function for
                    every write action, not by these routes. */}
                <Route path="gallery/:albumType" element={<GalleryAlbumListScreen />} />
                <Route path="gallery/album/:albumId" element={<GalleryAlbumDetailScreen />} />

                {/* Announcement Module (Task 10B, SRS Chapter 12): detail screen for
                    a single announcement. Public read within MainLayout, same as the
                    Announcements list screen itself — RBAC and VisibilityResolver are
                    both enforced inside the `announcements` Edge Function, not by this
                    route. */}
                <Route path="announcements/:id" element={<AnnouncementDetailScreen />} />

                {/* Notification Module (Task 10C, SRS 12.10/23.17/24.16): not a
                    Bottom Navigation Bar tab (SRS 24.8 fixes that set), reached via
                    the TopBar bell icon instead. Public within MainLayout the same
                    way Announcements/Gallery are — ownership of which notifications
                    are returned is enforced inside the `notifications` Edge
                    Function, not by this route. */}
                <Route path="notifications" element={<NotificationsScreen />} />

                {/* Live Darshan & Katha Module (Task 10D, SRS Chapter 10 /
                    SDD 4.5): not a Bottom Navigation Bar tab (SRS 24.8 fixes
                    that set), reached from the Home Dashboard's Live Darshan
                    Card instead. Public read within MainLayout, same as
                    Gallery/Announcements — RBAC for Saturday Schedule
                    visibility (FR-LIVE-009), stream configuration
                    (FR-LIVE-013/014), and archive management (10.9) is all
                    enforced inside the `live-darshan` Edge Function, not by
                    this route. */}
                <Route path="live-darshan" element={<LiveDarshanScreen />} />

                <Route
                  element={<RequirePermission moduleKey="member_management" action="search_members" />}
                >
                  <Route path={MEMBER_MANAGEMENT_PATH.slice(1)} element={<MemberManagementScreen />} />
                </Route>

                <Route element={<RequireAuditLogAccess />}>
                  <Route path={AUDIT_LOG_PATH.slice(1)} element={<AuditLogScreen />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
