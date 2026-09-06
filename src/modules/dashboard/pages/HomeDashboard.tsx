import { WelcomeHeader } from '@modules/dashboard/components/WelcomeHeader';
import { PanchangCard } from '@modules/dashboard/components/PanchangCard';
import { DailyDarshanCard } from '@modules/dashboard/components/DailyDarshanCard';
import { TodaysThalCard } from '@modules/dashboard/components/TodaysThalCard';
import { LiveDarshanCard } from '@modules/dashboard/components/LiveDarshanCard';
import { FestivalCountdownCard } from '@modules/dashboard/components/FestivalCountdownCard';
import { AnnouncementsSection } from '@modules/dashboard/components/AnnouncementsSection';
import { UpcomingSabhaCard } from '@modules/dashboard/components/UpcomingSabhaCard';
import { QuickActions } from '@modules/dashboard/components/QuickActions';
import { SpiritualQuoteSection } from '@modules/dashboard/components/SpiritualQuoteSection';

/**
 * Home Dashboard route (SRS Chapter 8 / SDD 8.1 MainLayout > RouteOutlet >
 * HomeDashboard). Bottom Nav "Home" destination and landing page for
 * returning devotees.
 *
 * Section order follows SRS 8.3 exactly: Welcome Header, Daily Panchang
 * Card, Daily Darshan Card, Today's Thal Card, Live Darshan Card,
 * Festival Countdown Card, Announcements Section, Upcoming Sabha Card,
 * Quick Actions, Daily Spiritual Quote. (The Bottom Navigation Bar itself
 * is rendered once by MainLayout, not per-page.)
 *
 * No dashboard data service exists yet (Panchang, Daily Darshan, Daily
 * Thal, Live Darshan, Festival Calendar, Announcements, Sabha scheduling,
 * Spiritual Quote — none of their backing modules are built). Every card
 * below is written to accept real data once that service exists (see
 * dashboard.types.ts) and, until then, renders the exact empty/fallback
 * state the SRS specifies for "no data available" rather than inventing
 * placeholder content.
 */
export function HomeDashboard() {
  return (
    // No horizontal/vertical padding here — RootLayout's <main> (which
    // wraps every route) already applies px-4 py-4 (sm:px-6 lg:px-8).
    <div className="flex flex-col gap-4">
      <WelcomeHeader />
      <PanchangCard />
      <DailyDarshanCard />
      <TodaysThalCard />
      <LiveDarshanCard />
      <FestivalCountdownCard />
      <AnnouncementsSection />
      <UpcomingSabhaCard />
      <QuickActions />
      <SpiritualQuoteSection />
    </div>
  );
}
