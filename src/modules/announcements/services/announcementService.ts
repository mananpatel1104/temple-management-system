import { ApiError, functionsClient } from '@shared/lib/functionsClient';
import { supabase } from '@shared/lib/supabaseClient';
import {
  cacheAnnouncementAttachment,
  cacheAnnouncementsMetadata,
  getCachedAnnouncementAttachmentUrl,
  getCachedAnnouncementsMetadata,
} from '@offline/cacheStrategies';
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementListResult,
  AnnouncementSearchResult,
  CreateAnnouncementInput,
  RequestAttachmentUploadUrlResult,
  UpdateAnnouncementInput,
} from '../types/announcement.types';

/**
 * AnnouncementController-equivalent client service (SDD 4.7). View
 * actions (list/get/search) never require a session token — Devotees
 * browse Announcements without authenticating, matching Gallery and the
 * rest of this application's auth model — but they DO forward whatever
 * editor session token happens to be active, since VisibilityResolver
 * widens the result set for an authenticated editor (see the Edge
 * Function's file header). Passing `undefined` is fine; the request is
 * simply treated as anonymous/Devotee.
 *
 * View actions also implement SRS 12.14 offline viewing, the same
 * "opportunistic cache on success, fall back to cache on network
 * failure" strategy as galleryService.ts. Search is intentionally NOT
 * cached, matching Gallery's rationale (only previously *viewed*
 * content needs to remain available offline). Mutations never touch
 * this cache.
 */

async function withCachedAttachment(announcement: Announcement): Promise<Announcement> {
  if (!announcement.attachment_url) return announcement;
  const cached = await getCachedAnnouncementAttachmentUrl(announcement.announcement_id);
  return { ...announcement, attachment_url: cached ?? announcement.attachment_url };
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'NETWORK';
}

export const announcementService = {
  async list(
    params: { view?: 'active' | 'archived'; category?: AnnouncementCategory; limit?: number; offset?: number } = {},
    sessionToken?: string | null,
  ): Promise<AnnouncementListResult> {
    const cacheKey = `list:${params.view ?? 'active'}:${params.category ?? 'all'}:${params.limit ?? 50}:${params.offset ?? 0}`;
    try {
      const result = await functionsClient.post<AnnouncementListResult>(
        'announcements',
        { action: 'list', ...params },
        sessionToken,
      );
      void cacheAnnouncementsMetadata(cacheKey, result);
      for (const a of result.announcements) {
        void cacheAnnouncementAttachment(a.announcement_id, a.attachment_url);
      }
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedAnnouncementsMetadata<AnnouncementListResult>(cacheKey);
      if (!cached) throw error;
      return { ...cached, announcements: await Promise.all(cached.announcements.map(withCachedAttachment)) };
    }
  },

  async get(id: string, sessionToken?: string | null): Promise<Announcement> {
    const cacheKey = `get:${id}`;
    try {
      const result = await functionsClient.post<Announcement>('announcements', { action: 'get', id }, sessionToken);
      void cacheAnnouncementsMetadata(cacheKey, result);
      void cacheAnnouncementAttachment(result.announcement_id, result.attachment_url);
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedAnnouncementsMetadata<Announcement>(cacheKey);
      if (!cached) throw error;
      return withCachedAttachment(cached);
    }
  },

  async search(query: string, sessionToken?: string | null): Promise<AnnouncementSearchResult> {
    return functionsClient.post<AnnouncementSearchResult>('announcements', { action: 'search', query }, sessionToken);
  },

  async create(sessionToken: string, input: CreateAnnouncementInput): Promise<Announcement> {
    return functionsClient.post<Announcement>('announcements', { action: 'create', ...input }, sessionToken);
  },

  async update(sessionToken: string, input: UpdateAnnouncementInput): Promise<Announcement> {
    return functionsClient.post<Announcement>('announcements', { action: 'update', ...input }, sessionToken);
  },

  async archive(sessionToken: string, id: string, archived = true): Promise<void> {
    await functionsClient.post('announcements', { action: 'archive', id, archived }, sessionToken);
  },

  async restore(sessionToken: string, id: string): Promise<void> {
    await functionsClient.post('announcements', { action: 'archive', id, archived: false }, sessionToken);
  },

  async remove(sessionToken: string, id: string): Promise<void> {
    await functionsClient.post('announcements', { action: 'delete', id }, sessionToken);
  },

  /**
   * Attachment upload flow (mirrors galleryService.uploadPhoto's Data
   * Flow): the announcement must already exist (create it first without
   * an attachment, then call this) — requestAttachmentUploadUrl ->
   * direct-to-storage PUT -> confirmAttachmentUpload persists the path.
   */
  async uploadAttachment(
    sessionToken: string,
    params: { id: string; file: File; attachmentType: 'image' | 'pdf' },
  ): Promise<Announcement> {
    const { id, file, attachmentType } = params;

    const uploadTarget = await functionsClient.post<RequestAttachmentUploadUrlResult>(
      'announcements',
      { action: 'requestAttachmentUploadUrl', id, fileName: file.name, mimeType: file.type, fileSize: file.size },
      sessionToken,
    );

    const { error: uploadError } = await supabase.storage
      .from('announcement-attachments')
      .uploadToSignedUrl(uploadTarget.path, uploadTarget.token, file);
    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed.');
    }

    return functionsClient.post<Announcement>(
      'announcements',
      { action: 'confirmAttachmentUpload', id, storagePath: uploadTarget.path, attachmentType },
      sessionToken,
    );
  },
};
