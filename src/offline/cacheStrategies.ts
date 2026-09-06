/**
 * Gallery offline cache helpers (NFR-GAL-001; Task 10A-FIX).
 *
 * Gallery photos live in a PRIVATE Supabase Storage bucket and are only
 * ever served via short-lived signed URLs (SEC-020) — every listAlbums /
 * getAlbum / listPhotos call mints a FRESH signed URL (new token) for
 * the same underlying photo. That breaks the default Workbox runtime
 * caching already configured in vite.config.ts: CacheFirst/NetworkFirst
 * there key their cache entries off the full request URL, so a photo
 * that was cached under yesterday's token is never matched by today's
 * differently-tokened URL, and — because the Gallery Edge Function is
 * called over POST — its JSON responses aren't captured by that runtime
 * caching at all (Workbox's default routes only match GET).
 *
 * This module is the "minimum architecture required" fix for that,
 * built directly on the same browser Cache Storage API the service
 * worker already uses (no IndexedDB, no sync engine, no new framework):
 *
 *   - Photo/cover image BYTES are cached under a synthetic same-origin
 *     request keyed by a stable id (photo_id / "album-cover:<album_id>")
 *     instead of the rotating signed URL, so a lookup still succeeds
 *     after the token has changed or expired.
 *   - The small listAlbums/getAlbum/listPhotos JSON payloads are cached
 *     the same way, keyed by the logical request they answered, so the
 *     Gallery screens have something to render at all while offline.
 *
 * Everything here is best-effort and additive: callers still always try
 * the network first (see galleryService.ts). Nothing here changes what
 * is fetched, only what is opportunistically retained client-side for
 * content the user already viewed while online. Mutations (create/
 * rename/delete/archive/upload) never read or write this cache, so they
 * correctly continue to require the network.
 */

const GALLERY_IMAGE_CACHE = 'gallery-image-cache-v1';
const GALLERY_METADATA_CACHE = 'gallery-metadata-cache-v1';
const CACHE_ORIGIN = 'https://gallery-offline-cache.local';

function isCacheStorageAvailable(): boolean {
  return typeof caches !== 'undefined';
}

function imageCacheKey(id: string): Request {
  return new Request(`${CACHE_ORIGIN}/image/${encodeURIComponent(id)}`);
}

function metadataCacheKey(key: string): Request {
  return new Request(`${CACHE_ORIGIN}/meta/${encodeURIComponent(key)}`);
}

/**
 * Best-effort: fetches `url` (a live signed URL) and stores the bytes
 * under the stable `id` so they can be retrieved later regardless of
 * that URL's token having since rotated or expired. Never throws —
 * a caching failure must never break the (already-succeeded) network
 * request that triggered it.
 */
export async function cacheGalleryImage(id: string | null | undefined, url: string | null | undefined): Promise<void> {
  if (!isCacheStorageAvailable() || !id || !url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const cache = await caches.open(GALLERY_IMAGE_CACHE);
    await cache.put(imageCacheKey(id), response);
  } catch {
    // Offline, CORS failure, quota exceeded, etc. — best-effort only.
  }
}

/**
 * Returns a locally-usable object URL for a previously-cached image, or
 * null if it was never cached (e.g. the photo was never viewed while
 * online) — callers must treat null as "unavailable offline", per
 * NFR-GAL-001, not as an error.
 */
export async function getCachedGalleryImageUrl(id: string | null | undefined): Promise<string | null> {
  if (!isCacheStorageAvailable() || !id) return null;
  try {
    const cache = await caches.open(GALLERY_IMAGE_CACHE);
    const response = await cache.match(imageCacheKey(id));
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Best-effort JSON metadata cache (album/photo lists), same rationale as above. */
export async function cacheGalleryMetadata<T>(key: string, data: T): Promise<void> {
  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await caches.open(GALLERY_METADATA_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(metadataCacheKey(key), response);
  } catch {
    // Best-effort only.
  }
}

export async function getCachedGalleryMetadata<T>(key: string): Promise<T | null> {
  if (!isCacheStorageAvailable()) return null;
  try {
    const cache = await caches.open(GALLERY_METADATA_CACHE);
    const response = await cache.match(metadataCacheKey(key));
    if (!response) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Announcement Module offline cache (SRS 12.14/Task 10B §15): "Without
 * internet, previously viewed announcements remain available." Same
 * Cache-Storage-API pattern as the Gallery helpers above, kept in a
 * separate cache namespace since announcements are JSON records (no
 * rotating-signed-URL image problem to work around for the records
 * themselves — only their optional attachment_url needs the same
 * stable-key treatment as Gallery photos). Mutations (create/update/
 * archive/restore/delete/attachment upload) never read or write this
 * cache — SRS 12.14 explicitly excludes new announcements and sync from
 * offline availability, so those correctly continue to require the
 * network.
 */
const ANNOUNCEMENTS_METADATA_CACHE = 'announcements-metadata-cache-v1';
const ANNOUNCEMENTS_ATTACHMENT_CACHE = 'announcements-attachment-cache-v1';
const ANNOUNCEMENTS_CACHE_ORIGIN = 'https://announcements-offline-cache.local';

function announcementMetadataCacheKey(key: string): Request {
  return new Request(`${ANNOUNCEMENTS_CACHE_ORIGIN}/meta/${encodeURIComponent(key)}`);
}

function announcementAttachmentCacheKey(id: string): Request {
  return new Request(`${ANNOUNCEMENTS_CACHE_ORIGIN}/attachment/${encodeURIComponent(id)}`);
}

export async function cacheAnnouncementsMetadata<T>(key: string, data: T): Promise<void> {
  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await caches.open(ANNOUNCEMENTS_METADATA_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(announcementMetadataCacheKey(key), response);
  } catch {
    // Best-effort only.
  }
}

export async function getCachedAnnouncementsMetadata<T>(key: string): Promise<T | null> {
  if (!isCacheStorageAvailable()) return null;
  try {
    const cache = await caches.open(ANNOUNCEMENTS_METADATA_CACHE);
    const response = await cache.match(announcementMetadataCacheKey(key));
    if (!response) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Same rotating-signed-URL rationale as Gallery's cacheGalleryImage — best-effort, never throws. */
export async function cacheAnnouncementAttachment(
  id: string | null | undefined,
  url: string | null | undefined,
): Promise<void> {
  if (!isCacheStorageAvailable() || !id || !url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const cache = await caches.open(ANNOUNCEMENTS_ATTACHMENT_CACHE);
    await cache.put(announcementAttachmentCacheKey(id), response);
  } catch {
    // Offline, CORS failure, quota exceeded, etc. — best-effort only.
  }
}

export async function getCachedAnnouncementAttachmentUrl(id: string | null | undefined): Promise<string | null> {
  if (!isCacheStorageAvailable() || !id) return null;
  try {
    const cache = await caches.open(ANNOUNCEMENTS_ATTACHMENT_CACHE);
    const response = await cache.match(announcementAttachmentCacheKey(id));
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Notification offline cache (Task 10C; SRS 12.14-style offline
 * behaviour applied to Notifications — SDD 5.4/23.17). Same
 * "opportunistic cache on success, fall back to cache on network
 * failure" JSON-metadata-only strategy as Announcements above; there is
 * no attachment/binary content to mirror for notifications. Mutations
 * (Mark as Read) never read or write this cache — SRS 12.14's "new
 * announcements, synchronization ... unavailable [offline]" principle
 * applies equally here, so marking as read still correctly requires the
 * network; only previously-fetched notification lists remain viewable
 * offline.
 */
const NOTIFICATIONS_METADATA_CACHE = 'notifications-metadata-cache-v1';
const NOTIFICATIONS_CACHE_ORIGIN = 'https://notifications-offline-cache.local';

function notificationsMetadataCacheKey(key: string): Request {
  return new Request(`${NOTIFICATIONS_CACHE_ORIGIN}/meta/${encodeURIComponent(key)}`);
}

export async function cacheNotificationsMetadata<T>(key: string, data: T): Promise<void> {
  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await caches.open(NOTIFICATIONS_METADATA_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(notificationsMetadataCacheKey(key), response);
  } catch {
    // Best-effort only.
  }
}

export async function getCachedNotificationsMetadata<T>(key: string): Promise<T | null> {
  if (!isCacheStorageAvailable()) return null;
  try {
    const cache = await caches.open(NOTIFICATIONS_METADATA_CACHE);
    const response = await cache.match(notificationsMetadataCacheKey(key));
    if (!response) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Live Darshan & Katha offline cache (Task 10D; SRS 10.8). SRS 10.8 is
 * explicit that Live Darshan/Live Katha/Katha Archive *playback*
 * require the internet — it does NOT say the Katha Archive *listing*
 * or the Saturday Katha schedule must also be unavailable offline, and
 * the task brief allows caching "previously available Katha/archive
 * information" — so, same "opportunistic cache on success, fall back
 * to cache on network failure" JSON-metadata-only strategy as
 * Announcements/Notifications above. Live status (getStatus) is
 * intentionally NOT cached here: a stale cached LIVE/OFFLINE flag would
 * mislead a devotee into either missing a real broadcast or trying to
 * "watch" a stream that both requires the network AND has since ended —
 * the live-darshan screen instead shows the offline message immediately
 * when isOffline is true, without attempting (or serving a cached
 * answer to) a status call at all. Mutations (configureStream/
 * updateSaturdaySchedule/createArchiveEntry/removeArchiveEntry) never
 * read or write this cache.
 */
const LIVE_DARSHAN_METADATA_CACHE = 'live-darshan-metadata-cache-v1';
const LIVE_DARSHAN_CACHE_ORIGIN = 'https://live-darshan-offline-cache.local';

function liveDarshanMetadataCacheKey(key: string): Request {
  return new Request(`${LIVE_DARSHAN_CACHE_ORIGIN}/meta/${encodeURIComponent(key)}`);
}

export async function cacheLiveDarshanMetadata<T>(key: string, data: T): Promise<void> {
  if (!isCacheStorageAvailable()) return;
  try {
    const cache = await caches.open(LIVE_DARSHAN_METADATA_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
    await cache.put(liveDarshanMetadataCacheKey(key), response);
  } catch {
    // Best-effort only.
  }
}

export async function getCachedLiveDarshanMetadata<T>(key: string): Promise<T | null> {
  if (!isCacheStorageAvailable()) return null;
  try {
    const cache = await caches.open(LIVE_DARSHAN_METADATA_CACHE);
    const response = await cache.match(liveDarshanMetadataCacheKey(key));
    if (!response) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
