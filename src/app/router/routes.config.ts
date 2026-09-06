import type { ComponentType } from 'react';
import type { TranslationKey } from '@i18n/i18n.config';
import { HomeDashboard } from '@modules/dashboard/pages/HomeDashboard';
import { AnnouncementsScreen } from '@modules/announcements/pages/AnnouncementsScreen';
import { GalleryScreen } from '@modules/gallery/pages/GalleryScreen';
import { LibraryScreen } from '@modules/library/pages/LibraryScreen';
import { MoreScreen } from '@modules/settings/pages/MoreScreen';

export interface AppRouteConfig {
  /** Path segment, relative to the app root (no leading slash). */
  path: string;
  /** Page component rendered inside MainLayout's RouteOutlet. */
  component: ComponentType;
  /** Bottom Navigation Bar label (SRS 24.8). */
  navLabelKey: TranslationKey;
  /** Bottom Navigation Bar icon — mapped to an inline SVG in BottomNavigationBar. */
  navIcon: 'home' | 'announcements' | 'gallery' | 'library' | 'more';
}

/**
 * Central route registry, driving both React Router (AppRouter.tsx) and
 * the Bottom Navigation Bar (BottomNavigationBar.tsx) from a single
 * source of truth — SRS 24.8 fixes the tab set and order (Home,
 * Announcements, Gallery, Library, More), so neither file should ever
 * need to hard-code it separately.
 *
 * Every route here is guarded: it only renders once the devotee has
 * completed language selection (see RouteGuards.tsx).
 */
export const appRoutes: AppRouteConfig[] = [
  {
    path: 'home',
    component: HomeDashboard,
    navLabelKey: 'nav.home',
    navIcon: 'home',
  },
  {
    path: 'announcements',
    component: AnnouncementsScreen,
    navLabelKey: 'nav.announcements',
    navIcon: 'announcements',
  },
  {
    path: 'gallery',
    component: GalleryScreen,
    navLabelKey: 'nav.gallery',
    navIcon: 'gallery',
  },
  {
    path: 'library',
    component: LibraryScreen,
    navLabelKey: 'nav.library',
    navIcon: 'library',
  },
  {
    path: 'more',
    component: MoreScreen,
    navLabelKey: 'nav.more',
    navIcon: 'more',
  },
];

/** Landing route for devotees who have completed language selection. */
export const HOME_PATH = '/home';

/** First-launch registration screen (FR-AUTH-003/004/005) — Task 9. */
export const REGISTRATION_PATH = '/register';

/** Editor Login screen (FR-AUTH-006) — Task 9. */
export const EDITOR_LOGIN_PATH = '/editor-login';

/** Member Management admin screens (SRS Chapter 13) — Supreme Administrator only. */
export const MEMBER_MANAGEMENT_PATH = '/member-management';

/** Audit Log screen (SRS Chapter 18) — Trustee (limited) / Supreme Administrator (full). */
export const AUDIT_LOG_PATH = '/audit-log';
