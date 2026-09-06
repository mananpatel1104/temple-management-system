import { ApiError, functionsClient } from '@shared/lib/functionsClient';
import { cacheLiveDarshanMetadata, getCachedLiveDarshanMetadata } from '@offline/cacheStrategies';
import type {
  ConfigureStreamInput,
  CreateArchiveEntryInput,
  KathaArchiveListResult,
  LiveStatusResult,
  SaturdayKathaSchedule,
  UpdateSaturdayScheduleInput,
} from '../types/liveDarshan.types';

/**
 * LiveStatusController/KathaArchiveController-equivalent client service
 * (SDD 4.5). See `supabase/functions/live-darshan/index.ts` header for
 * the full public-vs-restricted read model this mirrors.
 */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'NETWORK';
}

export const liveDarshanService = {
  /**
   * FR-LIVE-001/002/003/005/006/007. Callers are expected to only
   * invoke this while online (SRS 10.8) — see LiveDarshanScreen, which
   * skips this call entirely and shows the offline message instead.
   * Deliberately not cached (see cacheStrategies.ts header note).
   */
  async getStatus(sessionToken?: string | null): Promise<LiveStatusResult> {
    return functionsClient.post<LiveStatusResult>('live-darshan', { action: 'getStatus' }, sessionToken);
  },

  /** FR-LIVE-010/011. Public read, cached opportunistically (SRS 10.8 restricts *playback*, not this listing). */
  async listArchive(params: { limit?: number; offset?: number } = {}): Promise<KathaArchiveListResult> {
    const cacheKey = `archive:${params.limit ?? 50}:${params.offset ?? 0}`;
    try {
      const result = await functionsClient.post<KathaArchiveListResult>('live-darshan', {
        action: 'listArchive',
        ...params,
      });
      void cacheLiveDarshanMetadata(cacheKey, result);
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedLiveDarshanMetadata<KathaArchiveListResult>(cacheKey);
      if (!cached) throw error;
      return cached;
    }
  },

  /** FR-LIVE-008/009 — restricted read; requires a permitted editor session. */
  async getSaturdaySchedule(sessionToken: string): Promise<SaturdayKathaSchedule | null> {
    const cacheKey = 'saturday-schedule';
    try {
      const result = await functionsClient.post<SaturdayKathaSchedule | null>(
        'live-darshan',
        { action: 'getSaturdaySchedule' },
        sessionToken,
      );
      void cacheLiveDarshanMetadata(cacheKey, result);
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedLiveDarshanMetadata<SaturdayKathaSchedule | null>(cacheKey);
      if (cached === null) throw error;
      return cached;
    }
  },

  /** FR-LIVE-013/014 — Supreme Administrator only, enforced server-side. */
  async configureStream(sessionToken: string, input: ConfigureStreamInput): Promise<void> {
    await functionsClient.post('live-darshan', { action: 'configureStream', ...input }, sessionToken);
  },

  /** 10.9 "Edit Saturday Schedule" — Shreeji Yuvak Mandal Head / Supreme Administrator, enforced server-side. */
  async updateSaturdaySchedule(sessionToken: string, input: UpdateSaturdayScheduleInput): Promise<SaturdayKathaSchedule> {
    return functionsClient.post<SaturdayKathaSchedule>(
      'live-darshan',
      { action: 'updateSaturdaySchedule', ...input },
      sessionToken,
    );
  },

  /** FR-LIVE-012 "archive ... outdated recordings" — Supreme Administrator only, enforced server-side. */
  async createArchiveEntry(sessionToken: string, input: CreateArchiveEntryInput) {
    return functionsClient.post('live-darshan', { action: 'createArchiveEntry', ...input }, sessionToken);
  },

  /** 10.9 "Remove Archive" — Supreme Administrator only, enforced server-side. */
  async removeArchiveEntry(sessionToken: string, archiveId: string): Promise<void> {
    await functionsClient.post('live-darshan', { action: 'removeArchiveEntry', archiveId }, sessionToken);
  },
};
