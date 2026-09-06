/**
 * Live Darshan & Katha Module types (SRS Chapter 10; SDD 4.5). Mirrors
 * the shapes returned by the `live-darshan` Edge Function
 * (supabase/functions/live-darshan).
 */

/** FR-LIVE-001/002/003: Live Darshan status. */
export interface LiveDarshanStatusResult {
  isLive: boolean;
  streamUrl: string | null;
  updatedAt: string | null;
}

/** FR-LIVE-005/006/007: Live Katha status, plus its descriptive fields. */
export interface LiveKathaStatusResult {
  isLive: boolean;
  streamUrl: string | null;
  title: string | null;
  speakerName: string | null;
  kathaDate: string | null;
  kathaTime: string | null;
  updatedAt: string | null;
}

export interface LiveStatusResult {
  darshan: LiveDarshanStatusResult;
  katha: LiveKathaStatusResult;
}

/** FR-LIVE-008: Saturday Katha schedule (singleton row). */
export interface SaturdayKathaSchedule {
  schedule_id: string;
  day_label: string;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  updated_at: string;
}

/** FR-LIVE-010: a single Katha Archive recording. */
export interface KathaArchiveEntry {
  archive_id: string;
  title: string;
  katha_date: string;
  speaker_name: string | null;
  thumbnail_url: string | null;
  watch_url: string;
  created_at: string;
}

export interface KathaArchiveListResult {
  entries: KathaArchiveEntry[];
  total: number;
}

/** FR-LIVE-013/014: admin configuration payload for either stream. */
export interface ConfigureStreamInput {
  streamType: 'darshan' | 'katha';
  streamUrl?: string | null;
  isLive: boolean;
  /** Katha-only fields (FR-LIVE-005); ignored for streamType 'darshan'. */
  title?: string | null;
  speakerName?: string | null;
  kathaDate?: string | null;
  kathaTime?: string | null;
}

export interface UpdateSaturdayScheduleInput {
  eventDate?: string | null;
  eventTime?: string | null;
  venue?: string | null;
}

export interface CreateArchiveEntryInput {
  title: string;
  kathaDate: string;
  speakerName?: string | null;
  thumbnailUrl?: string | null;
  watchUrl: string;
}
