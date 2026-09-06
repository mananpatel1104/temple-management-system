import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import {
  isNonEmptyString,
  validateArchiveTitle,
  validateOptionalDate,
  validateOptionalKathaTitle,
  validateOptionalSpeakerName,
  validateOptionalStreamUrl,
  validateOptionalThumbnailUrl,
  validateOptionalTime,
  validateOptionalVenue,
  validateRequiredDate,
  validateStreamUrl,
} from '../_shared/validation.ts';

/**
 * POST /live-darshan
 * Body: { action: 'getStatus' | 'listArchive' | 'getSaturdaySchedule' |
 *         'configureStream' | 'updateSaturdaySchedule' |
 *         'createArchiveEntry' | 'removeArchiveEntry', ...params }
 *
 * Live Darshan & Katha Module (SRS Chapter 10; SDD 4.5
 * LiveStatusController / KathaArchiveController). Single action-routed
 * function, matching the gallery/announcements/notifications
 * convention so RBAC (10.9 permission table) is enforced in exactly
 * one place.
 *
 * VIEW ACTIONS (getStatus/listArchive) are PUBLIC reads — 10.9 grants
 * "Watch Live Darshan"/"Watch Live Katha"/"View Katha Archive" to every
 * role, including Devotee, who never authenticates at all (SRS Chapter
 * 6). getSaturdaySchedule is the one read action that is NOT public:
 * FR-LIVE-009 restricts the Saturday Katha reminder to Shreeji Yuvak
 * Mandal Head / Trustee / Supreme Administrator, so it calls
 * requirePermission() like a write action would.
 *
 * WRITE ACTIONS (configureStream/updateSaturdaySchedule/
 * createArchiveEntry/removeArchiveEntry) all call requirePermission()
 * against the same PermissionMatrix used by every other module
 * (SEC-ROLE-001–004), then recordAudit() on success.
 *
 * This application never hosts video (SDD 4.5 "Purpose") — every
 * "stream" here is a redirect to an externally-configured URL. See the
 * migration's header comment for why LIVE/OFFLINE is a manually-set
 * flag rather than an auto-detected one.
 */
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
    case 'getStatus':
      return handleGetStatus();
    case 'listArchive':
      return handleListArchive(body);
    case 'getSaturdaySchedule':
      return handleGetSaturdaySchedule(req);
    case 'configureStream':
      return handleConfigureStream(req, body);
    case 'updateSaturdaySchedule':
      return handleUpdateSaturdaySchedule(req, body);
    case 'createArchiveEntry':
      return handleCreateArchiveEntry(req, body);
    case 'removeArchiveEntry':
      return handleRemoveArchiveEntry(req, body);
    default:
      return jsonError(`Unknown action "${action}".`, '400');
  }
});

// ---------------------------------------------------------------------
// View actions — public (no session required, see file header)
// ---------------------------------------------------------------------

const STATUS_COLUMNS =
  'stream_type, stream_url, is_live, katha_title, speaker_name, katha_date, katha_time, updated_at';

// FR-LIVE-001/002/003, FR-LIVE-005/006/007: current Live Darshan + Live Katha state.
async function handleGetStatus(): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('live_stream_config').select(STATUS_COLUMNS);

  if (error) {
    console.error('live-darshan getStatus failed', error);
    return jsonError('Failed to load live status.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];
  const darshan = rows.find((r) => r.stream_type === 'darshan') ?? null;
  const katha = rows.find((r) => r.stream_type === 'katha') ?? null;

  return jsonSuccess({
    darshan: darshan
      ? {
          isLive: Boolean(darshan.is_live && darshan.stream_url),
          streamUrl: darshan.stream_url ?? null,
          updatedAt: darshan.updated_at,
        }
      : { isLive: false, streamUrl: null, updatedAt: null },
    katha: katha
      ? {
          isLive: Boolean(katha.is_live && katha.stream_url),
          streamUrl: katha.stream_url ?? null,
          title: katha.katha_title ?? null,
          speakerName: katha.speaker_name ?? null,
          kathaDate: katha.katha_date ?? null,
          kathaTime: katha.katha_time ?? null,
          updatedAt: katha.updated_at,
        }
      : { isLive: false, streamUrl: null, title: null, speakerName: null, kathaDate: null, kathaTime: null, updatedAt: null },
  });
}

// FR-LIVE-010/011: reverse-chronological Katha Archive listing.
async function handleListArchive(body: Record<string, unknown>): Promise<Response> {
  const limit = typeof body.limit === 'number' && body.limit > 0 && body.limit <= 100 ? body.limit : 50;
  const offset = typeof body.offset === 'number' && body.offset >= 0 ? body.offset : 0;

  const admin = getSupabaseAdmin();
  const { data, error, count } = await admin
    .from('katha_archive')
    .select('archive_id, title, katha_date, speaker_name, thumbnail_url, watch_url, created_at', { count: 'exact' })
    .eq('is_deleted', false)
    .order('katha_date', { ascending: false }) // FR-LIVE-011: newest first
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('live-darshan listArchive failed', error);
    return jsonError('Failed to load Katha Archive.', '500');
  }

  return jsonSuccess({ entries: data ?? [], total: count ?? (data ?? []).length });
}

// FR-LIVE-008/009: Saturday Katha schedule — role-restricted read (not public).
async function handleGetSaturdaySchedule(req: Request): Promise<Response> {
  const auth = await requirePermission(req, 'live_darshan', 'view_saturday_schedule');
  if (!auth.granted) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('saturday_katha_schedule')
    .select('schedule_id, day_label, event_date, event_time, venue, updated_at')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('live-darshan getSaturdaySchedule failed', error);
    return jsonError('Failed to load the Saturday Katha schedule.', '500');
  }

  return jsonSuccess(data ?? null);
}

// ---------------------------------------------------------------------
// Write actions — all require the matching 10.9 permission
// ---------------------------------------------------------------------

// FR-LIVE-013/014: Supreme Administrator configures the Live Darshan or
// Live Katha stream (URL, LIVE/OFFLINE flag, and — for Katha — the
// FR-LIVE-005 descriptive fields). A single action handles both stream
// types (streamType body param) rather than two near-duplicate actions.
async function handleConfigureStream(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'live_darshan', 'configure_stream');
  if (!auth.granted) return auth.response;

  const streamType = body.streamType;
  if (streamType !== 'darshan' && streamType !== 'katha') {
    return jsonError('streamType must be "darshan" or "katha".', '400');
  }

  const isLive = Boolean(body.isLive);
  // An empty/omitted URL is how the Supreme Administrator clears a
  // stream back to "not configured" (FR-LIVE-003/error-handling
  // "Live Stream has not been configured") — required only when isLive
  // is being turned on (can't be LIVE with no destination to redirect to).
  const urlError = validateOptionalStreamUrl(body.streamUrl);
  if (urlError) return jsonError(urlError, '400');
  const streamUrl = typeof body.streamUrl === 'string' && body.streamUrl.trim() ? body.streamUrl.trim() : null;
  if (isLive && !streamUrl) {
    return jsonError('A stream URL is required to mark this stream LIVE.', '400');
  }

  // deno-lint-ignore no-explicit-any
  const update: Record<string, any> = {
    stream_url: streamUrl,
    is_live: isLive,
    updated_by: auth.claims.sub,
    updated_at: new Date().toISOString(),
  };

  if (streamType === 'katha') {
    const titleError = validateOptionalKathaTitle(body.title);
    if (titleError) return jsonError(titleError, '400');
    const speakerError = validateOptionalSpeakerName(body.speakerName);
    if (speakerError) return jsonError(speakerError, '400');
    const dateError = validateOptionalDate(body.kathaDate);
    if (dateError) return jsonError(dateError, '400');
    const timeError = validateOptionalTime(body.kathaTime);
    if (timeError) return jsonError(timeError, '400');

    update.katha_title = typeof body.title === 'string' && body.title ? body.title : null;
    update.speaker_name = typeof body.speakerName === 'string' && body.speakerName ? body.speakerName : null;
    update.katha_date = typeof body.kathaDate === 'string' && body.kathaDate ? body.kathaDate : null;
    update.katha_time = typeof body.kathaTime === 'string' && body.kathaTime ? body.kathaTime : null;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('live_stream_config')
    .update(update)
    .eq('stream_type', streamType)
    .select(STATUS_COLUMNS)
    .single();

  if (error || !data) {
    console.error('live-darshan configureStream failed', error);
    return jsonError('Failed to update stream configuration.', '500');
  }

  await recordAudit({
    module: 'Live Darshan',
    action: streamType === 'darshan' ? 'LIVE_DARSHAN_STREAM_CONFIGURED' : 'LIVE_KATHA_STREAM_CONFIGURED',
    category: 'Live Darshan',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { streamType, streamUrl, isLive },
    remarks: `${streamType === 'darshan' ? 'Live Darshan' : 'Live Katha'} stream configuration updated (isLive=${isLive}).`,
  });

  return jsonSuccess(data, 'Stream configuration updated.');
}

// 10.9 "Edit Saturday Schedule" (Shreeji Yuvak Mandal Head / Supreme Administrator).
async function handleUpdateSaturdaySchedule(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'live_darshan', 'edit_saturday_schedule');
  if (!auth.granted) return auth.response;

  const dateError = validateOptionalDate(body.eventDate);
  if (dateError) return jsonError(dateError, '400');
  const timeError = validateOptionalTime(body.eventTime);
  if (timeError) return jsonError(timeError, '400');
  const venueError = validateOptionalVenue(body.venue);
  if (venueError) return jsonError(venueError, '400');

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin.from('saturday_katha_schedule').select('schedule_id').limit(1).maybeSingle();
  if (!existing) return jsonError('Saturday Katha schedule row not found.', '404');

  const { data, error } = await admin
    .from('saturday_katha_schedule')
    .update({
      event_date: typeof body.eventDate === 'string' && body.eventDate ? body.eventDate : null,
      event_time: typeof body.eventTime === 'string' && body.eventTime ? body.eventTime : null,
      venue: typeof body.venue === 'string' && body.venue ? body.venue : null,
      updated_by: auth.claims.sub,
      updated_at: new Date().toISOString(),
    })
    .eq('schedule_id', existing.schedule_id)
    .select('schedule_id, day_label, event_date, event_time, venue, updated_at')
    .single();

  if (error || !data) {
    console.error('live-darshan updateSaturdaySchedule failed', error);
    return jsonError('Failed to update the Saturday Katha schedule.', '500');
  }

  await recordAudit({
    module: 'Live Darshan',
    action: 'SATURDAY_KATHA_SCHEDULE_UPDATED',
    category: 'Live Darshan',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { eventDate: data.event_date, eventTime: data.event_time, venue: data.venue },
    remarks: 'Saturday Katha schedule updated.',
  });

  return jsonSuccess(data, 'Saturday Katha schedule updated.');
}

// FR-LIVE-012 "may archive ... outdated recordings" — Supreme Administrator only.
async function handleCreateArchiveEntry(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'live_darshan', 'manage_archive');
  if (!auth.granted) return auth.response;

  const titleError = validateArchiveTitle(body.title);
  if (titleError) return jsonError(titleError, '400');
  const dateError = validateRequiredDate(body.kathaDate);
  if (dateError) return jsonError(dateError, '400');
  const speakerError = validateOptionalSpeakerName(body.speakerName);
  if (speakerError) return jsonError(speakerError, '400');
  const thumbError = validateOptionalThumbnailUrl(body.thumbnailUrl);
  if (thumbError) return jsonError(thumbError, '400');
  const urlError = validateStreamUrl(body.watchUrl);
  if (urlError) return jsonError(urlError, '400');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('katha_archive')
    .insert({
      title: (body.title as string).trim(),
      katha_date: body.kathaDate,
      speaker_name: typeof body.speakerName === 'string' && body.speakerName ? body.speakerName : null,
      thumbnail_url: typeof body.thumbnailUrl === 'string' && body.thumbnailUrl ? body.thumbnailUrl : null,
      watch_url: (body.watchUrl as string).trim(),
      created_by: auth.claims.sub,
    })
    .select('archive_id, title, katha_date, speaker_name, thumbnail_url, watch_url, created_at')
    .single();

  if (error || !data) {
    console.error('live-darshan createArchiveEntry failed', error);
    return jsonError('Failed to add the Katha Archive entry.', '500');
  }

  await recordAudit({
    module: 'Live Darshan',
    action: 'KATHA_ARCHIVE_ENTRY_CREATED',
    category: 'Live Darshan',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { archive_id: data.archive_id, title: data.title },
    remarks: `Katha Archive entry "${data.title}" added.`,
  });

  return jsonSuccess(data, 'Katha Archive entry added.', 201);
}

// 10.9 "Remove Archive" — Supreme Administrator only; soft delete (FR-LIVE-012).
async function handleRemoveArchiveEntry(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'live_darshan', 'manage_archive');
  if (!auth.granted) return auth.response;

  const archiveId = body.archiveId;
  if (!isNonEmptyString(archiveId)) return jsonError('archiveId is required.', '400');

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('katha_archive')
    .select('archive_id, title')
    .eq('archive_id', archiveId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !existing) return jsonError('Katha Archive entry not found.', '404');

  const { error: updateError } = await admin
    .from('katha_archive')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: auth.claims.sub })
    .eq('archive_id', archiveId);
  if (updateError) return jsonError('Failed to remove the Katha Archive entry.', '500');

  await recordAudit({
    module: 'Live Darshan',
    action: 'KATHA_ARCHIVE_ENTRY_REMOVED',
    category: 'Live Darshan',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    remarks: `Katha Archive entry "${existing.title}" (${archiveId}) removed (soft delete).`,
  });

  return jsonSuccess(null, 'Katha Archive entry removed.');
}
