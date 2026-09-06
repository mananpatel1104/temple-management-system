import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import {
  isNonEmptyString,
  validateAlbumName,
  validateCreatableAlbumType,
  validateGalleryFileSize,
  validateGalleryMimeType,
  validateOptionalCaption,
} from '../_shared/validation.ts';

/**
 * POST /gallery
 * Body: { action: 'listAlbums' | 'getAlbum' | 'listPhotos' | 'search' |
 *         'createAlbum' | 'renameAlbum' | 'deleteAlbum' | 'archiveAlbum' |
 *         'deletePhoto' | 'requestUploadUrl' | 'confirmUpload', ...params }
 *
 * Gallery Module (SRS Chapter 11; SDD 4.6 GalleryController). A single
 * action-routed function, matching the existing member-management
 * pattern, so RBAC (11.17 permission table) is enforced in exactly one
 * place.
 *
 * VIEW ACTIONS (listAlbums/getAlbum/listPhotos/search) require NO
 * editor session: per 11.17 "View Gallery"/"Search Photos" are ✅ for
 * every role including Devotee, and Devotees never authenticate at all
 * in this application (SRS Chapter 6 — no PIN, no session token). These
 * actions are therefore public reads, brokered entirely through this
 * service-role function (never direct PostgREST/table access — RLS on
 * gallery_albums/gallery_photos denies the anon key completely, see
 * migration 0004). Photo/cover image bytes themselves stay private:
 * every response returns a short-lived SIGNED URL from the private
 * `gallery` storage bucket, never a public URL (SEC-020).
 *
 * WRITE ACTIONS all call requirePermission() against the same
 * PermissionMatrix used by every other module (SEC-ROLE-001–004).
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — short-lived per SEC-020, refreshed on every view

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  const action = body.action;
  if (typeof action !== 'string') {
    return jsonError('action is required.', '400');
  }

  switch (action) {
    case 'listAlbums':
      return handleListAlbums(body);
    case 'getAlbum':
      return handleGetAlbum(body);
    case 'listPhotos':
      return handleListPhotos(body);
    case 'search':
      return handleSearch(body);
    case 'createAlbum':
      return handleCreateAlbum(req, body);
    case 'renameAlbum':
      return handleRenameAlbum(req, body);
    case 'deleteAlbum':
      return handleDeleteAlbum(req, body);
    case 'archiveAlbum':
      return handleArchiveAlbum(req, body);
    case 'deletePhoto':
      return handleDeletePhoto(req, body);
    case 'requestUploadUrl':
      return handleRequestUploadUrl(req, body);
    case 'confirmUpload':
      return handleConfirmUpload(req, body);
    default:
      return jsonError(`Unknown action "${action}".`, '400');
  }
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function signPath(
  // deno-lint-ignore no-explicit-any
  admin: any,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await admin.storage.from('gallery').createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}

// ---------------------------------------------------------------------
// View actions — public (no session required, see file header)
// ---------------------------------------------------------------------

// FR-GAL-001: Gallery Home categories, reverse-chronological within each.
async function handleListAlbums(body: Record<string, unknown>): Promise<Response> {
  const albumType = body.albumType;
  const admin = getSupabaseAdmin();

  let query = admin
    .from('gallery_albums')
    .select('album_id, album_name, album_type, cover_image_path, album_date, created_at, is_archived')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (typeof albumType === 'string' && albumType) {
    query = query.eq('album_type', albumType);
  }
  // Archived albums are excluded from the normal Gallery Home browsing
  // experience by default (11.13 "archive albums" implies removal from
  // the everyday view); there is no requirement to surface an
  // "archived albums" browsing mode for any role in the SRS, so none is
  // built here.
  query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) {
    console.error('gallery listAlbums failed', error);
    return jsonError('Failed to load albums.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];
  const albumIds = rows.map((r) => r.album_id);

  // FR-GAL-005: "Number of Photos" per album.
  const counts = new Map<string, number>();
  if (albumIds.length > 0) {
    const { data: photoRows } = await admin
      .from('gallery_photos')
      .select('album_id')
      .in('album_id', albumIds)
      .eq('is_deleted', false);
    for (const p of (photoRows ?? []) as { album_id: string }[]) {
      counts.set(p.album_id, (counts.get(p.album_id) ?? 0) + 1);
    }
  }

  const albums = await Promise.all(
    rows.map(async (a) => ({
      album_id: a.album_id,
      album_name: a.album_name,
      album_type: a.album_type,
      album_date: a.album_date,
      cover_image_url: await signPath(admin, a.cover_image_path),
      photo_count: counts.get(a.album_id) ?? 0,
      created_at: a.created_at,
    })),
  );

  return jsonSuccess({ albums });
}

async function handleGetAlbum(body: Record<string, unknown>): Promise<Response> {
  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');

  const admin = getSupabaseAdmin();
  const { data: album, error } = await admin
    .from('gallery_albums')
    .select('album_id, album_name, album_type, cover_image_path, album_date, created_at, is_archived')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error || !album) return jsonError('Album not found.', '404');

  const { count } = await admin
    .from('gallery_photos')
    .select('photo_id', { count: 'exact', head: true })
    .eq('album_id', albumId)
    .eq('is_deleted', false);

  return jsonSuccess({
    album_id: album.album_id,
    album_name: album.album_name,
    album_type: album.album_type,
    album_date: album.album_date,
    cover_image_url: await signPath(admin, album.cover_image_path),
    photo_count: count ?? 0,
    created_at: album.created_at,
    is_archived: album.is_archived,
  });
}

// FR-GAL-003: newest Daily Darshan photograph (and, generally, newest
// upload) first within an album.
async function handleListPhotos(body: Record<string, unknown>): Promise<Response> {
  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');

  const limit = Math.min(Number(body.limit ?? 60) || 60, 200);
  const offset = Number(body.offset ?? 0) || 0;

  const admin = getSupabaseAdmin();
  const { data, error, count } = await admin
    .from('gallery_photos')
    .select('photo_id, album_id, storage_path, caption, uploaded_by, upload_time, members(full_name)', {
      count: 'exact',
    })
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .order('upload_time', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('gallery listPhotos failed', error);
    return jsonError('Failed to load photos.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];
  const photos = await Promise.all(
    rows.map(async (p) => ({
      photo_id: p.photo_id,
      album_id: p.album_id,
      // FR-GAL-014: uploader's name visible to all users for Daily
      // Darshan; applied uniformly to every photo here since the SRS
      // does not restrict uploader visibility for any other album type.
      uploaded_by_name: p.members?.full_name ?? null,
      caption: p.caption,
      upload_time: p.upload_time,
      photo_url: await signPath(admin, p.storage_path),
    })),
  );

  return jsonSuccess({ photos, total: count ?? photos.length });
}

// FR-GAL-017: search by Festival Name, Album Name, Year, Caption.
async function handleSearch(body: Record<string, unknown>): Promise<Response> {
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return jsonSuccess({ albums: [], photos: [] });

  const admin = getSupabaseAdmin();
  const isYear = /^\d{4}$/.test(query);

  let albumQuery = admin
    .from('gallery_albums')
    .select('album_id, album_name, album_type, cover_image_path, album_date, created_at')
    .eq('is_deleted', false)
    .eq('is_archived', false);

  albumQuery = isYear
    ? albumQuery.or(`album_name.ilike.%${query}%,album_date.gte.${query}-01-01,album_date.lte.${query}-12-31`)
    : albumQuery.ilike('album_name', `%${query}%`);

  const { data: albumRows, error: albumError } = await albumQuery.order('created_at', { ascending: false });
  if (albumError) {
    console.error('gallery search (albums) failed', albumError);
    return jsonError('Search failed.', '500');
  }

  const { data: photoRows, error: photoError } = await admin
    .from('gallery_photos')
    .select('photo_id, album_id, storage_path, caption, upload_time, gallery_albums(album_name)')
    .eq('is_deleted', false)
    .ilike('caption', `%${query}%`)
    .order('upload_time', { ascending: false })
    .limit(50);
  if (photoError) {
    console.error('gallery search (photos) failed', photoError);
    return jsonError('Search failed.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const aRows = (albumRows ?? []) as any[];
  // deno-lint-ignore no-explicit-any
  const pRows = (photoRows ?? []) as any[];

  const albums = await Promise.all(
    aRows.map(async (a) => ({
      album_id: a.album_id,
      album_name: a.album_name,
      album_type: a.album_type,
      album_date: a.album_date,
      cover_image_url: await signPath(admin, a.cover_image_path),
    })),
  );

  const photos = await Promise.all(
    pRows.map(async (p) => ({
      photo_id: p.photo_id,
      album_id: p.album_id,
      album_name: p.gallery_albums?.album_name ?? null,
      caption: p.caption,
      upload_time: p.upload_time,
      photo_url: await signPath(admin, p.storage_path),
    })),
  );

  return jsonSuccess({ albums, photos });
}

// ---------------------------------------------------------------------
// Album management — Supreme Administrator only (FR-GAL-015)
// ---------------------------------------------------------------------

async function handleCreateAlbum(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'create_album');
  if (!auth.granted) return auth.response;

  const nameError = validateAlbumName(body.albumName);
  if (nameError) return jsonError(nameError, '400');
  const typeError = validateCreatableAlbumType(body.albumType);
  if (typeError) return jsonError(typeError, '400');

  const albumDate = typeof body.albumDate === 'string' && body.albumDate ? body.albumDate : null;

  const admin = getSupabaseAdmin();
  const { data: album, error } = await admin
    .from('gallery_albums')
    .insert({
      album_name: (body.albumName as string).trim(),
      album_type: body.albumType,
      album_date: albumDate,
      created_by: auth.claims.sub,
    })
    .select('album_id, album_name, album_type, album_date, created_at')
    .single();

  if (error || !album) {
    console.error('gallery createAlbum failed', error);
    return jsonError('Failed to create album.', '500');
  }

  await recordAudit({
    module: 'Gallery',
    action: 'ALBUM_CREATED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { album_id: album.album_id, album_name: album.album_name, album_type: album.album_type },
    remarks: `Album "${album.album_name}" (${album.album_type}) created.`,
  });

  return jsonSuccess(album, 'Album created.', 201);
}

async function handleRenameAlbum(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'rename_album');
  if (!auth.granted) return auth.response;

  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');
  const nameError = validateAlbumName(body.albumName);
  if (nameError) return jsonError(nameError, '400');

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('gallery_albums')
    .select('album_id, album_name')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !existing) return jsonError('Album not found.', '404');

  const { error: updateError } = await admin
    .from('gallery_albums')
    .update({ album_name: (body.albumName as string).trim() })
    .eq('album_id', albumId);
  if (updateError) return jsonError('Failed to rename album.', '500');

  await recordAudit({
    module: 'Gallery',
    action: 'ALBUM_RENAMED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    previousValue: { album_name: existing.album_name },
    newValue: { album_name: (body.albumName as string).trim() },
    remarks: `Album ${albumId} renamed.`,
  });

  return jsonSuccess(null, 'Album renamed.');
}

// FR-GAL-015 "delete" — soft delete (SDD 5.5): the row and every photo
// that references it are preserved; the album simply stops appearing
// in listAlbums/getAlbum/search.
async function handleDeleteAlbum(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'delete_album');
  if (!auth.granted) return auth.response;

  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('gallery_albums')
    .select('album_id, album_name, album_type')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !existing) return jsonError('Album not found.', '404');
  if (existing.album_type === 'daily_darshan') {
    return jsonError('The Daily Darshan album cannot be deleted.', '400');
  }

  const { error: updateError } = await admin
    .from('gallery_albums')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: auth.claims.sub })
    .eq('album_id', albumId);
  if (updateError) return jsonError('Failed to delete album.', '500');

  await recordAudit({
    module: 'Gallery',
    action: 'ALBUM_DELETED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    remarks: `Album "${existing.album_name}" (${albumId}) deleted (soft).`,
  });

  return jsonSuccess(null, 'Album deleted.');
}

// FR-GAL-015 "archive" — a distinct, togglable state from delete.
async function handleArchiveAlbum(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'archive_album');
  if (!auth.granted) return auth.response;

  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');
  const archived = body.archived !== false; // defaults to true (archive); pass archived:false to restore

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('gallery_albums')
    .select('album_id, album_name')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !existing) return jsonError('Album not found.', '404');

  const { error: updateError } = await admin
    .from('gallery_albums')
    .update({
      is_archived: archived,
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? auth.claims.sub : null,
    })
    .eq('album_id', albumId);
  if (updateError) return jsonError('Failed to update album.', '500');

  await recordAudit({
    module: 'Gallery',
    action: archived ? 'ALBUM_ARCHIVED' : 'ALBUM_UNARCHIVED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    remarks: `Album "${existing.album_name}" (${albumId}) ${archived ? 'archived' : 'unarchived'}.`,
  });

  return jsonSuccess(null, archived ? 'Album archived.' : 'Album restored.');
}

async function handleDeletePhoto(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'delete_photo');
  if (!auth.granted) return auth.response;

  const photoId = body.photoId;
  if (!isNonEmptyString(photoId)) return jsonError('photoId is required.', '400');

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('gallery_photos')
    .select('photo_id, album_id')
    .eq('photo_id', photoId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !existing) return jsonError('Photo not found.', '404');

  const { error: updateError } = await admin
    .from('gallery_photos')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: auth.claims.sub })
    .eq('photo_id', photoId);
  if (updateError) return jsonError('Failed to delete photo.', '500');

  await recordAudit({
    module: 'Gallery',
    action: 'PHOTO_DELETED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    remarks: `Photo ${photoId} deleted (soft) from album ${existing.album_id}.`,
  });

  return jsonSuccess(null, 'Photo deleted.');
}

// ---------------------------------------------------------------------
// Upload flow (SDD 4.6 Data Flow) — Shreeji Yuvak Mandal Head / Supreme
// Administrator only (11.9, FR-GAL-016)
// ---------------------------------------------------------------------

// Step 1: client requests a signed upload URL for direct-to-storage
// upload (never proxied through this function's own request body,
// keeping large binaries off the Edge Function entirely).
async function handleRequestUploadUrl(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'upload');
  if (!auth.granted) return auth.response;

  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');
  const fileName = body.fileName;
  if (!isNonEmptyString(fileName)) return jsonError('fileName is required.', '400');

  const mimeError = validateGalleryMimeType(body.mimeType);
  if (mimeError) return jsonError(mimeError, '400');
  const sizeError = validateGalleryFileSize(body.fileSize);
  if (sizeError) return jsonError(sizeError, '400');

  const admin = getSupabaseAdmin();
  const { data: album, error: albumError } = await admin
    .from('gallery_albums')
    .select('album_id')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (albumError || !album) return jsonError('Album not found.', '404');

  const safeName = sanitizeFileName(fileName as string);
  const path = `${albumId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { data: signed, error: signError } = await admin.storage
    .from('gallery')
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    console.error('gallery requestUploadUrl failed', signError);
    return jsonError('Failed to prepare upload.', '500');
  }

  return jsonSuccess({
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
  });
}

// Step 2: after the client has uploaded the binary directly to Storage
// using the signed URL above, it calls this to persist the metadata row
// (FR-GAL-010/011 "upload progress" happens client-side during Step 1's
// actual PUT; this call is the fast metadata-only step that follows).
async function handleConfirmUpload(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'gallery', 'upload');
  if (!auth.granted) return auth.response;

  const albumId = body.albumId;
  if (!isNonEmptyString(albumId)) return jsonError('albumId is required.', '400');
  const storagePath = body.storagePath;
  if (!isNonEmptyString(storagePath) || !(storagePath as string).startsWith(`${albumId}/`)) {
    return jsonError('storagePath is invalid for this album.', '400');
  }
  const captionError = validateOptionalCaption(body.caption);
  if (captionError) return jsonError(captionError, '400');

  const admin = getSupabaseAdmin();
  const { data: album, error: albumError } = await admin
    .from('gallery_albums')
    .select('album_id, album_type, cover_image_path')
    .eq('album_id', albumId)
    .eq('is_deleted', false)
    .maybeSingle();
  if (albumError || !album) return jsonError('Album not found.', '404');

  const { data: photo, error: insertError } = await admin
    .from('gallery_photos')
    .insert({
      album_id: albumId,
      storage_path: storagePath,
      caption: typeof body.caption === 'string' && body.caption ? body.caption : null,
      uploaded_by: auth.claims.sub,
    })
    .select('photo_id, album_id, storage_path, caption, upload_time')
    .single();
  if (insertError || !photo) {
    console.error('gallery confirmUpload failed', insertError);
    return jsonError('Failed to save photo.', '500');
  }

  // FR-GAL-011: newest upload becomes the album cover if none is set
  // yet, so albums with no explicit cover are never blank (11.5 "Album
  // Cover" is a required display field).
  if (!album.cover_image_path) {
    await admin.from('gallery_albums').update({ cover_image_path: storagePath }).eq('album_id', albumId);
  }

  await recordAudit({
    module: 'Gallery',
    action: album.album_type === 'daily_darshan' ? 'DAILY_DARSHAN_UPLOADED' : 'PHOTO_UPLOADED',
    category: 'Gallery',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { photo_id: photo.photo_id, album_id: albumId },
    remarks: `Photo uploaded to album ${albumId}.`,
  });

  return jsonSuccess(
    {
      photo_id: photo.photo_id,
      album_id: photo.album_id,
      caption: photo.caption,
      upload_time: photo.upload_time,
      photo_url: await signPath(admin, photo.storage_path),
      uploaded_by_name: auth.claims.name,
    },
    'Photo uploaded.',
    201,
  );
}
