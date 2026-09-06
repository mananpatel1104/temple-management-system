import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNavigationBar } from './BottomNavigationBar';

/**
 * MainLayout (SDD 8.1: App Shell -> MainLayout -> TopBar / RouteOutlet /
 * BottomNavigationBar). Wraps every post-onboarding route (Home,
 * Announcements, Gallery, Library, More — SRS 24.8).
 *
 * Nested inside RootLayout (the outer App Shell), which still owns the
 * offline banner and safe-area handling. The Welcome Screen renders
 * directly under RootLayout, outside of this layout, since it has no
 * navigation chrome of its own (SRS 24.6) — see AppRouter.tsx.
 */
export function MainLayout() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col pb-20">
        <Outlet />
      </div>
      <BottomNavigationBar />
    </div>
  );
}
