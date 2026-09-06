/**
 * Data contracts for the Home Dashboard cards (SRS Chapter 8). None of
 * this data is fetched yet — no dashboard data service exists in the
 * project as of Task 5 — but typing the shape now means the next task
 * (wiring Supabase queries) only has to produce values matching these
 * interfaces and pass them into the existing card components; the cards
 * themselves already render correctly with `undefined`/`null` (their
 * SRS-specified empty states).
 */

/** FR-DASH-003: Official Vadtal Panchang summary shown on the dashboard. */
export interface PanchangSummary {
  gregorianDate: string;
  day: string;
  tithi: string;
  paksha: string;
  maas: string;
  sunrise: string;
  sunset: string;
}

/** FR-DASH-005/006/007: latest Daily Darshan photo. */
export interface DailyDarshanPhoto {
  photoUrl: string;
  uploadDate: string;
  uploadedByName: string;
}

/** FR-DASH-008/009: today's assigned Thal family. */
export interface TodaysThalAssignment {
  date: string;
  familyName: string;
  /** True after an edit — devotees only ever see "Thal Updated", never who changed it (FR-DASH-009). */
  wasUpdated: boolean;
}

/** FR-DASH-010/011: live streaming status. */
export interface LiveDarshanStatus {
  isLive: boolean;
  streamUrl: string | null;
}

/** FR-DASH-012/013: nearest upcoming festival. */
export interface FestivalCountdown {
  festivalName: string;
  festivalDate: string;
  remainingDays: number;
}

/** FR-DASH-014/015: a single role-filtered announcement summary. */
export interface AnnouncementSummary {
  id: string;
  title: string;
  publishedAt: string;
  priority: 'high' | 'medium' | 'low';
}

/** FR-DASH-016/017: next scheduled Sabha. */
export interface UpcomingSabha {
  name: string;
  date: string;
  time: string;
  location: string;
}

/** FR-DASH-018: Supreme-Administrator-configured spiritual quote. Section stays hidden when this is undefined. */
export interface SpiritualQuote {
  text: string;
  attribution?: string;
}
