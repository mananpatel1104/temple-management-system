import { ApiError, functionsClient } from '@shared/lib/functionsClient';
import { supabase } from '@shared/lib/supabaseClient';
import {
  cacheGalleryImage,
  cacheGalleryMetadata,
  getCachedGalleryImageUrl,
  getCachedGalleryMetadata,
} from '@offline/cacheStrategies';
import {
  isSupportedGalleryMimeType,
  isWithinGalleryFileSizeLimit,
  optimizeGalleryImage,
} from '../utils/imageOptimizer';
import type {
  AlbumType,
  CreatableAlbumType,
  GalleryAlbum,
  GalleryPhoto,
  GallerySearchResult,
  RequestUploadUrlResult,
} from '../types/gallery.types';

/**
 * GalleryController-equivalent client service (SDD 4.6). View actions
 * (listAlbums/getAlbum/listPhotos/search) never require a session token
 * — Devotees browse the Gallery without authenticating, matching the
 * rest of this application's auth model (see gallery Edge Function's
 * file header). Write actions require the caller's editor session
 * token, which is what gets the request past the Edge Function's
 * requirePermission() check.
 *
 * View actions also implement NFR-GAL-001 offline viewing (Task
 * 10A-FIX): on success they opportunistically persist their result
 * (metadata + image bytes) via src/offline/cacheStrategies.ts; on a
 * network failure they fall back to whatever was last cached. Search
 * is intentionally NOT cached — the SRS only requires previously
 * *viewed* content to remain available offline, not offline search.
 * Mutations never touch this cache, so they correctly keep requiring
 * the network (create/rename/delete/archive/upload/requestUploadUrl
 * are all unchanged below).
 */

/**
 * Rewrites cover_image_url to a cached blob URL when one is available,
 * since cached metadata's original signed URL is very likely expired by
 * the time it's read back offline (Storage tokens are short-lived) — a
 * locally cached image is always preferred over that stale URL. Only
 * falls back to the metadata's original URL when nothing was cached
 * (e.g. the cover was never actually viewed while online), so at least
 * something is attempted rather than showing nothing.
 */
async function withCachedCoverImage(album: GalleryAlbum): Promise<GalleryAlbum> {
  const cached = await getCachedGalleryImageUrl(`album-cover:${album.album_id}`);
  return { ...album, cover_image_url: cached ?? album.cover_image_url };
}

/** Same rationale as withCachedCoverImage, for individual gallery photos. */
async function withCachedPhotoImage(photo: GalleryPhoto): Promise<GalleryPhoto> {
  const cached = await getCachedGalleryImageUrl(`photo:${photo.photo_id}`);
  return { ...photo, photo_url: cached ?? photo.photo_url };
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'NETWORK';
}

export const galleryService = {
  async listAlbums(albumType?: AlbumType): Promise<GalleryAlbum[]> {
    const cacheKey = `albums:${albumType ?? 'all'}`;
    try {
      const result = await functionsClient.post<{ albums: GalleryAlbum[] }>('gallery', {
        action: 'listAlbums',
        albumType,
      });
      void cacheGalleryMetadata(cacheKey, result.albums);
      for (const album of result.albums) {
        void cacheGalleryImage(`album-cover:${album.album_id}`, album.cover_image_url);
      }
      return result.albums;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedGalleryMetadata<GalleryAlbum[]>(cacheKey);
      if (!cached) throw error;
      return Promise.all(cached.map(withCachedCoverImage));
    }
  },

  async getAlbum(albumId: string): Promise<GalleryAlbum> {
    const cacheKey = `album:${albumId}`;
    try {
      const album = await functionsClient.post<GalleryAlbum>('gallery', { action: 'getAlbum', albumId });
      void cacheGalleryMetadata(cacheKey, album);
      void cacheGalleryImage(`album-cover:${album.album_id}`, album.cover_image_url);
      return album;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedGalleryMetadata<GalleryAlbum>(cacheKey);
      if (!cached) throw error;
      return withCachedCoverImage(cached);
    }
  },

  async listPhotos(albumId: string, params: { limit?: number; offset?: number } = {}): Promise<{
    photos: GalleryPhoto[];
    total: number;
  }> {
    // Pagination isn't part of the cache key: the app only ever requests
    // the default first page (SDD 4.6 doesn't call for infinite scroll),
    // so keying by albumId alone keeps this a single, simple "last seen
    // page" cache entry per album rather than one per (limit, offset).
    const cacheKey = `photos:${albumId}`;
    try {
      const result = await functionsClient.post<{ photos: GalleryPhoto[]; total: number }>('gallery', {
        action: 'listPhotos',
        albumId,
        ...params,
      });
      void cacheGalleryMetadata(cacheKey, result);
      for (const photo of result.photos) {
        void cacheGalleryImage(`photo:${photo.photo_id}`, photo.photo_url);
      }
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedGalleryMetadata<{ photos: GalleryPhoto[]; total: number }>(cacheKey);
      if (!cached) throw error;
      return { ...cached, photos: await Promise.all(cached.photos.map(withCachedPhotoImage)) };
    }
  },

  async search(query: string): Promise<GallerySearchResult> {
    return functionsClient.post<GallerySearchResult>('gallery', { action: 'search', query });
  },

  async createAlbum(
    sessionToken: string,
    params: { albumName: string; albumType: CreatableAlbumType; albumDate?: string },
  ): Promise<GalleryAlbum> {
    return functionsClient.post<GalleryAlbum>('gallery', { action: 'createAlbum', ...params }, sessionToken);
  },

  async renameAlbum(sessionToken: string, albumId: string, albumName: string): Promise<void> {
    await functionsClient.post('gallery', { action: 'renameAlbum', albumId, albumName }, sessionToken);
  },

  async deleteAlbum(sessionToken: string, albumId: string): Promise<void> {
    await functionsClient.post('gallery', { action: 'deleteAlbum', albumId }, sessionToken);
  },

  async archiveAlbum(sessionToken: string, albumId: string, archived = true): Promise<void> {
    await functionsClient.post('gallery', { action: 'archiveAlbum', albumId, archived }, sessionToken);
  },

  async deletePhoto(sessionToken: string, photoId: string): Promise<void> {
    await functionsClient.post('gallery', { action: 'deletePhoto', photoId }, sessionToken);
  },

  /**
   * Full upload flow (SDD 4.6 Data Flow, extended by SDD 4.6
   * ImageOptimizer / Task 10A-FIX3):
   *   1. optimizeGalleryImage -> resize/compress client-side (never
   *      throws; falls back to the original file on any failure)
   *   2. requestUploadUrl -> signed upload URL issued by the Edge
   *      Function, using the OPTIMIZED file's name/type/size (the
   *      original file is never uploaded once optimization succeeds)
   *   3. client uploads the optimized binary directly to Storage using
   *      that URL
   *   4. confirmUpload -> Edge Function persists the gallery_photos row
   *
   * The optimized file is re-validated against the same client-side
   * MIME/size checks used at file-selection time before any network
   * call is made — optimization must never be able to smuggle a file
   * past the limits the server also enforces authoritatively.
   *
   * `onProgress` is best-effort: the underlying supabase-js storage
   * client does not currently expose upload progress events, so this
   * reports discrete phase transitions (0 -> "uploading" start, 100 ->
   * complete) rather than continuous byte-level progress. Documented
   * here rather than papered over with a fake continuous progress bar.
   */
  async uploadPhoto(
    sessionToken: string,
    params: { albumId: string; file: File; caption?: string },
    onProgress?: (phase: 'optimizing' | 'preparing' | 'uploading' | 'saving' | 'done') => void,
  ): Promise<GalleryPhoto> {
    const { albumId, caption } = params;

    onProgress?.('optimizing');
    const uploadFile = await optimizeGalleryImage(params.file);
    if (!isSupportedGalleryMimeType(uploadFile.type) || !isWithinGalleryFileSizeLimit(uploadFile.size)) {
      // Should not happen in practice (the optimizer only ever produces
      // a supported type, and never grows the file) — kept as a safety
      // net so a surprising browser quirk can never bypass validation.
      throw new Error('The optimized image did not pass upload validation. Please try a different photo.');
    }

    onProgress?.('preparing');
    const uploadTarget = await functionsClient.post<RequestUploadUrlResult>(
      'gallery',
      {
        action: 'requestUploadUrl',
        albumId,
        fileName: uploadFile.name,
        mimeType: uploadFile.type,
        fileSize: uploadFile.size,
      },
      sessionToken,
    );

    onProgress?.('uploading');
    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .uploadToSignedUrl(uploadTarget.path, uploadTarget.token, uploadFile);
    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed.');
    }

    onProgress?.('saving');
    const photo = await functionsClient.post<GalleryPhoto>(
      'gallery',
      { action: 'confirmUpload', albumId, storagePath: uploadTarget.path, caption },
      sessionToken,
    );

    onProgress?.('done');
    return photo;
  },
};
