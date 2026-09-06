import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission, resolveOptionalEditorRole } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import {
  isNonEmptyString,
  validateAnnouncementAttachmentFileSize,
  validateAnnouncementAttachmentMimeType,
  validateAnnouncementCategory,
  validateAnnouncementDescription,
  validateAnnouncementTitle,
  validateOptionalAnnouncementPriority,
  validateOptionalExpiryDate,
  validateOptionalExternalLink,
  validateOptionalPublishAt,
  validateOptionalVisibilityScope,
  escapePostgrestFilterValue,
  type AnnouncementCategory,
} from '../_shared/validation.ts';

/**
 * POST /announcements
 * Body: { action: 'list' | 'get' | 'search' | 'create' | 'update' |
 *         'archive' | 'delete' | 'requestAttachmentUploadUrl' |
 *         'confirmAttachmentUpload', ...params }
 *
 * Announcement Module (SRS Chapter 12 — Announcement portion only;
 * SDD 4.7 AnnouncementController/VisibilityResolver/ScheduledPublisher).
 * Single action-routed function, matching the gallery/member-management
 * convention so RBAC and VisibilityResolver are each enforced in
 * exactly one place.
 *
 * ===================================================================
 * VisibilityResolver (SDD 4.7) — THE core rule of this module
 * ===================================================================
 * Devotees never authenticate (no PIN, no session — SRS Chapter 6), so
 * "View Announcements" (12.15, ✅ for every role) is a PUBLIC read, same
 * as Gallery viewing. An Authorization Bearer editor session token is
 * OPTIONAL here: if present and valid it widens what is returned (an
 * authenticated Bhakti Mandal Head also sees Ladies announcements, a
 * Trustee also sees Men's/Ladies/Volunteer, etc.) — but its absence
 * never blocks the read, it just narrows it to the Devotee/anonymous
 * set. This is resolved with resolveOptionalEditorRole(), never
 * requirePermission(), for every read action below.
 *
 * FR-ANN-001..006 / BR-013 define visibility purely as category + role:
 *   - unauthenticated / devotee  -> general, festival, emergency
 *   - bhakti_mandal_head         -> + ladies
 *   - shreeji_yuvak_mandal_head  -> + mens
 *   - trustee                    -> + mens, ladies, volunteer (12.15/
 *                                    FR-ANN-003/004 explicitly include
 *                                    Trustee in Men's/Ladies visibility;
 *                                    Volunteer is included for Trustee
 *                                    as the closest available role given
 *                                    no volunteer-group membership table
 *                                    exists yet — see migration 0005's
 *                                    visibility_scope comment)
 *   - supreme_administrator      -> every category (no filter)
 * FR-ANN-006: Emergency always included for every role — modelled here
 * simply by 'emergency' being a member of every role's allowed set.
 *
 * The client NEVER receives an announcement outside this set, even via
 * direct API calls (SDD 4.7 "the client never receives announcements
 * outside its audience") — every read query below applies this filter
 * server-side; there is no client-side-only filtering anywhere.
 *
 * WRITE ACTIONS all call requirePermission() against the same
 * PermissionMatrix used by every other module (SEC-ROLE-001–004), plus
 * an ownership check for the *_own actions (edit_own/delete_own/
 * archive_own) — see requireEditRights()/requireArchiveRights() below.
 * ===================================================================
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — matches Gallery's convention
const ATTACHMENT_BUCKET = 'announcement-attachments';

const CATEGORY_CREATE_ACTION: Record<AnnouncementCategory, string> = {
  general: 'create_general',
  festival: 'create_festival',
  mens: 'create_mens',
  ladies: 'create_ladies',
  volunteer: 'create_volunteer',
  emergency: 'create_emergency',
};

/** VisibilityResolver — see file header. null return = no filter (sees everything, i.e. Supreme Administrator). */
function visibleCategoriesForRole(roleKey: string | null): AnnouncementCategory[] | null {
  switch (roleKey) {
    case 'supreme_administrator':
      return null;
    case 'trustee':
      return ['general', 'festival', 'emergency', 'mens', 'ladies', 'volunteer'];
    case 'shreeji_yuvak_mandal_head':
      return ['general', 'festival', 'emergency', 'mens'];
    case 'bhakti_mandal_head':
      return ['general', 'festival', 'emergency', 'ladies'];
    default:
      // null (anonymous/devotee) or any unrecognised value — narrowest set.
      return ['general', 'festival', 'emergency'];
  }
}

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
    case 'list':
      return handleList(req, body);
    case 'get':
      return handleGet(req, body);
    case 'search':
      return handleSearch(req, body);
    case 'create':
      return handleCreate(req, body);
    case 'update':
      return handleUpdate(req, body);
    case 'archive':
      return handleArchive(req, body);
    case 'delete':
      return handleDelete(req, body);
    case 'requestAttachmentUploadUrl':
      return handleRequestAttachmentUploadUrl(req, body);
    case 'confirmAttachmentUpload':
      return handleConfirmAttachmentUpload(req, body);
    default:
      return jsonError(`Unknown action "${action}".`, '400');
  }
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function signAttachment(
  // deno-lint-ignore no-explicit-any
  admin: any,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}

const PUBLIC_COLUMNS =
  'announcement_id, title, description, category, priority, visibility_scope, attachment_path, attachment_type, external_link, created_by, created_at, updated_at, publish_at, expiry_date, status, is_archived, members(full_name)';

// Task 12B (Personal Data Flow Audit): `created_by` (the raw member_id
// of the author) has no display purpose for a viewer — attribution is
// already covered by `created_by_name` (matches the Gallery module's
// FR-GAL-014 pattern of exposing only the uploader's name, never their
// member_id). The ONLY legitimate consumer of the raw id is the
// AnnouncementDetailScreen's client-side "isOwner" check, which decides
// whether to show Edit/Delete to the author themself — something only
// an authenticated editor could ever use. So it is now included only
// when the requester has a verified editor session (any role), never
// for anonymous/Devotee readers. This does not change who may actually
// edit/delete anything: every mutating endpoint below already
// re-verifies `created_by === auth.claims.sub` server-side regardless
// of what a list/get response contains.
// deno-lint-ignore no-explicit-any
async function toPublicShape(admin: any, row: any, requesterIsEditor: boolean) {
  return {
    announcement_id: row.announcement_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    visibility_scope: row.visibility_scope,
    attachment_type: row.attachment_type,
    attachment_url: await signAttachment(admin, row.attachment_path),
    external_link: row.external_link,
    created_by: requesterIsEditor ? row.created_by : null,
    created_by_name: row.members?.full_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    publish_at: row.publish_at,
    expiry_date: row.expiry_date,
    // Effective status recomputed at read time (defense in depth — see
    // migration 0005 header comment): never trust a possibly-stale
    // `status` column alone for what gets shown to the requester.
    status: effectiveStatus(row),
    is_archived: row.is_archived || effectiveStatus(row) === 'archived',
  };
}

// deno-lint-ignore no-explicit-any
function effectiveStatus(row: any): 'scheduled' | 'published' | 'archived' {
  const now = Date.now();
  if (row.is_archived) return 'archived';
  if (row.expiry_date && new Date(row.expiry_date).getTime() <= now) return 'archived';
  if (new Date(row.publish_at).getTime() > now) return 'scheduled';
  return 'published';
}

// ---------------------------------------------------------------------
// View actions — public read, optionally widened by an editor session
// (see file header VisibilityResolver)
// ---------------------------------------------------------------------

async function handleList(req: Request, body: Record<string, unknown>): Promise<Response> {
  const optional = await resolveOptionalEditorRole(req);
  const allowedCategories = visibleCategoriesForRole(optional?.roleKey ?? null);

  const view = body.view === 'archived' ? 'archived' : 'active';
  const categoryFilter = typeof body.category === 'string' ? body.category : undefined;
  const limit = Math.min(Number(body.limit ?? 50) || 50, 200);
  const offset = Number(body.offset ?? 0) || 0;

  const admin = getSupabaseAdmin();
  let query = admin.from('announcements').select(PUBLIC_COLUMNS, { count: 'exact' }).eq('is_deleted', false);

  if (allowedCategories) query = query.in('category', allowedCategories);
  if (categoryFilter) {
    if (allowedCategories && !allowedCategories.includes(categoryFilter as AnnouncementCategory)) {
      // Requested category outside the requester's visibility — return an empty page rather than leaking existence.
      return jsonSuccess({ announcements: [], total: 0 });
    }
    query = query.eq('category', categoryFilter);
  }

  const now = new Date().toISOString();
  if (view === 'active') {
    query = query.eq('is_archived', false).lte('publish_at', now).or(`expiry_date.is.null,expiry_date.gt.${now}`);
  } else {
    // Archive/history (12.11 "maintain an archive ... searchable" — visible to
    // any role that could see the category to begin with; restoring it is
    // the action gated to Supreme Administrator, not viewing it).
    query = query.or(`is_archived.eq.true,expiry_date.lte.${now}`);
  }

  // FR-ANN "display newest first" (12.16); within that, priority is
  // shown via the priority field itself rather than re-ordering, since
  // the SRS does not specify priority-first ordering for the main list.
  query = query.order('publish_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('announcements list failed', error);
    return jsonError('Failed to load announcements.', '500');
  }

  const rows = (data ?? []) as unknown[];
  const announcements = await Promise.all(rows.map((r) => toPublicShape(admin, r, Boolean(optional))));
  return jsonSuccess({ announcements, total: count ?? announcements.length });
}

async function handleGet(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');

  const optional = await resolveOptionalEditorRole(req);
  const allowedCategories = visibleCategoriesForRole(optional?.roleKey ?? null);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('announcements')
    .select(PUBLIC_COLUMNS)
    .eq('announcement_id', id)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error || !data) return jsonError('Announcement not found.', '404');
  // deno-lint-ignore no-explicit-any
  const row = data as any;
  if (allowedCategories && !allowedCategories.includes(row.category)) {
    // Not visible to this requester — respond 404, not 403, so category
    // membership itself is never leaked (SDD 4.7 "prevents data leakage
    // even via direct API calls").
    return jsonError('Announcement not found.', '404');
  }

  return jsonSuccess(await toPublicShape(admin, row, Boolean(optional)));
}

async function handleSearch(req: Request, body: Record<string, unknown>): Promise<Response> {
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return jsonSuccess({ announcements: [] });

  const optional = await resolveOptionalEditorRole(req);
  const allowedCategories = visibleCategoriesForRole(optional?.roleKey ?? null);

  const admin = getSupabaseAdmin();
  // 12.12 — search by Title, Date, Category, Keywords. Date/Category are
  // exposed as separate structured filters on 'list'; this endpoint
  // covers the free-text Title/Keywords case (keywords matched against
  // description too, since the SRS "Keywords" wording is broader than
  // Title alone).
  // Task 12D: escape user-controlled query text before interpolating
  // it into a raw PostgREST `.or(...)` filter (see
  // escapePostgrestFilterValue() in _shared/validation.ts).
  const safeQuery = escapePostgrestFilterValue(query);
  let dbQuery = admin
    .from('announcements')
    .select(PUBLIC_COLUMNS)
    .eq('is_deleted', false)
    .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
    .order('publish_at', { ascending: false })
    .limit(50);

  if (allowedCategories) dbQuery = dbQuery.in('category', allowedCategories);

  const { data, error } = await dbQuery;
  if (error) {
    console.error('announcements search failed', error);
    return jsonError('Search failed.', '500');
  }

  const rows = (data ?? []) as unknown[];
  const announcements = await Promise.all(rows.map((r) => toPublicShape(admin, r, Boolean(optional))));
  return jsonSuccess({ announcements });
}

// ---------------------------------------------------------------------
// Create / Update / Archive / Delete — RBAC + ownership enforced
// ---------------------------------------------------------------------

async function handleCreate(req: Request, body: Record<string, unknown>): Promise<Response> {
  const categoryError = validateAnnouncementCategory(body.category);
  if (categoryError) return jsonError(categoryError, '400');
  const category = body.category as AnnouncementCategory;

  const auth = await requirePermission(req, 'announcements', CATEGORY_CREATE_ACTION[category]);
  if (!auth.granted) return auth.response;

  const titleError = validateAnnouncementTitle(body.title);
  if (titleError) return jsonError(titleError, '400');
  const descriptionError = validateAnnouncementDescription(body.description);
  if (descriptionError) return jsonError(descriptionError, '400');
  const priorityError = validateOptionalAnnouncementPriority(body.priority);
  if (priorityError) return jsonError(priorityError, '400');
  const scopeError = validateOptionalVisibilityScope(body.visibilityScope);
  if (scopeError) return jsonError(scopeError, '400');
  const publishAtError = validateOptionalPublishAt(body.publishAt);
  if (publishAtError) return jsonError(publishAtError, '400');
  const expiryError = validateOptionalExpiryDate(body.expiryDate);
  if (expiryError) return jsonError(expiryError, '400');
  const linkError = validateOptionalExternalLink(body.externalLink);
  if (linkError) return jsonError(linkError, '400');

  const publishAt = typeof body.publishAt === 'string' && body.publishAt ? body.publishAt : new Date().toISOString();
  const expiryDate = typeof body.expiryDate === 'string' && body.expiryDate ? body.expiryDate : null;
  if (expiryDate && new Date(expiryDate).getTime() <= new Date(publishAt).getTime()) {
    return jsonError('expiryDate must be after publishAt.', '400');
  }

  const admin = getSupabaseAdmin();
  const { data: announcement, error } = await admin
    .from('announcements')
    .insert({
      title: (body.title as string).trim(),
      description: (body.description as string).trim(),
      category,
      priority: typeof body.priority === 'string' && body.priority ? body.priority : 'medium',
      visibility_scope: typeof body.visibilityScope === 'string' && body.visibilityScope ? body.visibilityScope : null,
      external_link: typeof body.externalLink === 'string' && body.externalLink ? body.externalLink : null,
      attachment_type: typeof body.externalLink === 'string' && body.externalLink ? 'link' : null,
      publish_at: publishAt,
      expiry_date: expiryDate,
      created_by: auth.claims.sub,
    })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error || !announcement) {
    console.error('announcements create failed', error);
    return jsonError('Failed to create announcement.', '500');
  }

  await recordAudit({
    module: 'Announcements',
    action: 'ANNOUNCEMENT_CREATED',
    category: 'Announcements',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    newValue: { announcement_id: announcement.announcement_id, title: announcement.title, category: announcement.category },
    remarks: `Announcement "${announcement.title}" (${announcement.category}) created.`,
  });

  return jsonSuccess(await toPublicShape(admin, announcement, true), 'Announcement created.', 201);
}

/** BR-015 / 12.15: own-content editors may only touch their own row; Supreme Administrator may touch any. */
async function requireEditRights(
  req: Request,
  id: string,
): Promise<
  | { granted: true; claims: { sub: string; name: string }; roleKey: string; existing: Record<string, unknown> }
  | { granted: false; response: Response }
> {
  const admin = getSupabaseAdmin();
  const { data: existing, error } = await admin
    .from('announcements')
    .select('announcement_id, title, description, category, priority, created_by, is_archived')
    .eq('announcement_id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error || !existing) return { granted: false, response: jsonError('Announcement not found.', '404') };

  const auth = await requirePermission(req, 'announcements', 'edit_any');
  if (auth.granted) {
    return { granted: true, claims: auth.claims, roleKey: auth.roleKey, existing };
  }

  const ownAuth = await requirePermission(req, 'announcements', 'edit_own');
  if (!ownAuth.granted) return { granted: false, response: ownAuth.response };
  if (existing.created_by !== ownAuth.claims.sub) {
    return { granted: false, response: jsonError('You can only edit your own announcements.', '403') };
  }
  return { granted: true, claims: ownAuth.claims, roleKey: ownAuth.roleKey, existing };
}

async function handleUpdate(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');

  const edit = await requireEditRights(req, id);
  if (!edit.granted) return edit.response;

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const titleError = validateAnnouncementTitle(body.title);
    if (titleError) return jsonError(titleError, '400');
    updates.title = (body.title as string).trim();
  }
  if (body.description !== undefined) {
    const descriptionError = validateAnnouncementDescription(body.description);
    if (descriptionError) return jsonError(descriptionError, '400');
    updates.description = (body.description as string).trim();
  }
  if (body.priority !== undefined) {
    const priorityError = validateOptionalAnnouncementPriority(body.priority);
    if (priorityError) return jsonError(priorityError, '400');
    updates.priority = body.priority;
  }
  if (body.visibilityScope !== undefined) {
    const scopeError = validateOptionalVisibilityScope(body.visibilityScope);
    if (scopeError) return jsonError(scopeError, '400');
    updates.visibility_scope = body.visibilityScope || null;
  }
  if (body.publishAt !== undefined) {
    const publishAtError = validateOptionalPublishAt(body.publishAt);
    if (publishAtError) return jsonError(publishAtError, '400');
    updates.publish_at = body.publishAt || new Date().toISOString();
  }
  if (body.expiryDate !== undefined) {
    const expiryError = validateOptionalExpiryDate(body.expiryDate);
    if (expiryError) return jsonError(expiryError, '400');
    updates.expiry_date = body.expiryDate || null;
  }
  if (body.externalLink !== undefined) {
    const linkError = validateOptionalExternalLink(body.externalLink);
    if (linkError) return jsonError(linkError, '400');
    updates.external_link = body.externalLink || null;
    if (body.externalLink) updates.attachment_type = 'link';
  }

  // NOTE: category is intentionally NOT editable here — changing an
  // announcement's category after creation would bypass the
  // create-time category-ownership check (BR-014: "Bhakti Mandal Head
  // can only create Ladies announcements"). An editor who needs a
  // different category should archive/delete and create a new one.

  if (Object.keys(updates).length === 0) {
    return jsonError('No valid fields to update.', '400');
  }

  const admin = getSupabaseAdmin();
  const { data: updated, error: updateError } = await admin
    .from('announcements')
    .update(updates)
    .eq('announcement_id', id)
    .select(PUBLIC_COLUMNS)
    .single();
  if (updateError || !updated) return jsonError('Failed to update announcement.', '500');

  await recordAudit({
    module: 'Announcements',
    action: 'ANNOUNCEMENT_UPDATED',
    category: 'Announcements',
    performedBy: edit.claims.sub,
    performedByName: edit.claims.name,
    performedByRole: edit.roleKey,
    previousValue: edit.existing,
    newValue: updates,
    remarks: `Announcement ${id} updated.`,
  });

  return jsonSuccess(await toPublicShape(admin, updated, true), 'Announcement updated.');
}

async function handleArchive(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');
  const archived = body.archived !== false; // default true (archive); pass archived:false to restore

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('announcements')
    .select('announcement_id, title, created_by, is_archived')
    .eq('announcement_id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (fetchError || !existing) return jsonError('Announcement not found.', '404');

  if (!archived) {
    // Restore — 12.15 "Restore Announcement" is Supreme-Administrator-only, no ownership carve-out.
    const auth = await requirePermission(req, 'announcements', 'restore');
    if (!auth.granted) return auth.response;

    const { error: updateError } = await admin
      .from('announcements')
      .update({ is_archived: false, archived_at: null, archived_by: null })
      .eq('announcement_id', id);
    if (updateError) return jsonError('Failed to restore announcement.', '500');

    await recordAudit({
      module: 'Announcements',
      action: 'ANNOUNCEMENT_RESTORED',
      category: 'Announcements',
      performedBy: auth.claims.sub,
      performedByName: auth.claims.name,
      performedByRole: auth.roleKey,
      remarks: `Announcement "${existing.title}" (${id}) restored.`,
    });
    return jsonSuccess(null, 'Announcement restored.');
  }

  // Archive — own-content editors may only archive their own; SA may archive any.
  const anyAuth = await requirePermission(req, 'announcements', 'archive_any');
  let claims: { sub: string; name: string };
  let roleKey: string;
  if (anyAuth.granted) {
    claims = anyAuth.claims;
    roleKey = anyAuth.roleKey;
  } else {
    const ownAuth = await requirePermission(req, 'announcements', 'archive_own');
    if (!ownAuth.granted) return ownAuth.response;
    if (existing.created_by !== ownAuth.claims.sub) {
      return jsonError('You can only archive your own announcements.', '403');
    }
    claims = ownAuth.claims;
    roleKey = ownAuth.roleKey;
  }

  const { error: updateError } = await admin
    .from('announcements')
    .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: claims.sub })
    .eq('announcement_id', id);
  if (updateError) return jsonError('Failed to archive announcement.', '500');

  await recordAudit({
    module: 'Announcements',
    action: 'ANNOUNCEMENT_ARCHIVED',
    category: 'Announcements',
    performedBy: claims.sub,
    performedByName: claims.name,
    performedByRole: roleKey,
    remarks: `Announcement "${existing.title}" (${id}) archived.`,
  });
  return jsonSuccess(null, 'Announcement archived.');
}

async function handleDelete(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .from('announcements')
    .select('announcement_id, title, created_by')
    .eq('announcement_id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (fetchError || !existing) return jsonError('Announcement not found.', '404');

  const anyAuth = await requirePermission(req, 'announcements', 'delete_any');
  let claims: { sub: string; name: string };
  let roleKey: string;
  if (anyAuth.granted) {
    claims = anyAuth.claims;
    roleKey = anyAuth.roleKey;
  } else {
    const ownAuth = await requirePermission(req, 'announcements', 'delete_own');
    if (!ownAuth.granted) return ownAuth.response;
    if (existing.created_by !== ownAuth.claims.sub) {
      return jsonError('You can only delete your own announcements.', '403');
    }
    claims = ownAuth.claims;
    roleKey = ownAuth.roleKey;
  }

  const { error: updateError } = await admin
    .from('announcements')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: claims.sub })
    .eq('announcement_id', id);
  if (updateError) return jsonError('Failed to delete announcement.', '500');

  await recordAudit({
    module: 'Announcements',
    action: 'ANNOUNCEMENT_DELETED',
    category: 'Announcements',
    performedBy: claims.sub,
    performedByName: claims.name,
    performedByRole: roleKey,
    remarks: `Announcement "${existing.title}" (${id}) deleted (soft).`,
  });
  return jsonSuccess(null, 'Announcement deleted.');
}

// ---------------------------------------------------------------------
// Attachment upload flow (SRS 12.9) — mirrors the Gallery two-step
// signed-upload pattern, against the SEPARATE `announcement-attachments`
// bucket (Task 10B §10). Requires the same edit rights as handleUpdate,
// since attaching a file modifies an existing announcement row.
// ---------------------------------------------------------------------

async function handleRequestAttachmentUploadUrl(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');
  const edit = await requireEditRights(req, id);
  if (!edit.granted) return edit.response;

  const fileName = body.fileName;
  if (!isNonEmptyString(fileName)) return jsonError('fileName is required.', '400');
  const mimeError = validateAnnouncementAttachmentMimeType(body.mimeType);
  if (mimeError) return jsonError(mimeError, '400');
  const sizeError = validateAnnouncementAttachmentFileSize(body.fileSize);
  if (sizeError) return jsonError(sizeError, '400');

  const safeName = sanitizeFileName(fileName as string);
  const path = `${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const admin = getSupabaseAdmin();
  const { data: signed, error: signError } = await admin.storage.from(ATTACHMENT_BUCKET).createSignedUploadUrl(path);
  if (signError || !signed) {
    console.error('announcements requestAttachmentUploadUrl failed', signError);
    return jsonError('Failed to prepare upload.', '500');
  }

  return jsonSuccess({ path: signed.path, token: signed.token, signedUrl: signed.signedUrl });
}

async function handleConfirmAttachmentUpload(req: Request, body: Record<string, unknown>): Promise<Response> {
  const id = body.id;
  if (!isNonEmptyString(id)) return jsonError('id is required.', '400');
  const edit = await requireEditRights(req, id);
  if (!edit.granted) return edit.response;

  const storagePath = body.storagePath;
  if (!isNonEmptyString(storagePath) || !(storagePath as string).startsWith(`${id}/`)) {
    return jsonError('storagePath is invalid for this announcement.', '400');
  }
  const attachmentType = body.attachmentType === 'pdf' ? 'pdf' : 'image';

  const admin = getSupabaseAdmin();
  // Attaching a file replaces any prior External Link (SRS 12.9: Image,
  // PDF, or External Link — the three are mutually exclusive per
  // announcement, not additive).
  const { data: updated, error: updateError } = await admin
    .from('announcements')
    .update({ attachment_path: storagePath, attachment_type: attachmentType, external_link: null })
    .eq('announcement_id', id)
    .select(PUBLIC_COLUMNS)
    .single();
  if (updateError || !updated) {
    console.error('announcements confirmAttachmentUpload failed', updateError);
    return jsonError('Failed to save attachment.', '500');
  }

  await recordAudit({
    module: 'Announcements',
    action: 'ANNOUNCEMENT_ATTACHMENT_UPLOADED',
    category: 'Announcements',
    performedBy: edit.claims.sub,
    performedByName: edit.claims.name,
    performedByRole: edit.roleKey,
    remarks: `Attachment uploaded for announcement ${id}.`,
  });

  return jsonSuccess(await toPublicShape(admin, updated, true), 'Attachment uploaded.', 201);
}
