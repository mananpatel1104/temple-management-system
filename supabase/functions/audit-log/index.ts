import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireEditorSession } from '../_shared/rbac.ts';
import { can } from '../_shared/permissionMatrix.ts';
import { recordAudit } from '../_shared/audit.ts';
import { escapePostgrestFilterValue } from '../_shared/validation.ts';

/**
 * GET  /audit-log?query=&module=&category=&from=&to=&limit=&offset=
 * POST /audit-log  { action: 'delete', auditId: number, reason: string }  (Supreme Administrator only)
 *
 * 18.8 Role-Based Visibility:
 *   - Trustee: Activity, User Name, Date, Time only (no previous/new
 *     values, no PIN-related records, no financial modifications).
 *   - Supreme Administrator: full record.
 *   - Every other role: no access at all (403).
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method === 'GET') return handleQuery(req);
  if (req.method === 'POST') return handleDelete(req);
  return jsonError('Method not allowed.', '400', 405);
});

async function handleQuery(req: Request): Promise<Response> {
  const session = await requireEditorSession(req);
  if (!session.ok) {
    return jsonError(
      session.reason === 'unauthenticated'
        ? 'Authentication required.'
        : 'This account is locked or suspended.',
      session.reason === 'unauthenticated' ? '401' : '403',
    );
  }

  const roleKey = session.roleKey;
  const canFull = can(roleKey as never, 'audit_log', 'view_full');
  const canLimited = can(roleKey as never, 'audit_log', 'view_limited');
  if (!canFull && !canLimited) {
    return jsonError('You do not have permission to view the Audit Log.', '403');
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('query')?.trim();
  const moduleFilter = url.searchParams.get('module') ?? undefined;
  const categoryFilter = url.searchParams.get('category') ?? undefined;
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
  const offset = Number(url.searchParams.get('offset') ?? 0) || 0;

  const admin = getSupabaseAdmin();
  let dbQuery = admin
    .from('audit_logs')
    .select(
      'audit_id, module, action, category, performed_by, performed_by_name, performed_by_role, target_member_id, previous_value, new_value, remarks, timestamp',
      { count: 'exact' },
    )
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    // Task 12D: escape user-controlled query text before interpolating
    // it into a raw PostgREST `.or(...)` filter (see
    // escapePostgrestFilterValue() in _shared/validation.ts).
    const safeQuery = escapePostgrestFilterValue(query);
    dbQuery = dbQuery.or(
      `performed_by_name.ilike.%${safeQuery}%,action.ilike.%${safeQuery}%,module.ilike.%${safeQuery}%`,
    );
  }
  if (moduleFilter) dbQuery = dbQuery.eq('module', moduleFilter);
  if (categoryFilter) dbQuery = dbQuery.eq('category', categoryFilter);
  if (from) dbQuery = dbQuery.gte('timestamp', from);
  if (to) dbQuery = dbQuery.lte('timestamp', to);

  // Trustees never see Authentication-category records (PIN operations)
  // or Financial Records, per 18.8.
  if (!canFull) {
    dbQuery = dbQuery.not('category', 'in', '("Authentication","Financial Records")');
  }

  const { data, error, count } = await dbQuery;
  if (error) {
    console.error('audit query failed', error);
    return jsonError('Audit query failed.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];

  const shaped = rows.map((row) =>
    canFull
      ? {
          audit_id: row.audit_id,
          module: row.module,
          action: row.action,
          category: row.category,
          performed_by: row.performed_by,
          performed_by_name: row.performed_by_name,
          performed_by_role: row.performed_by_role,
          target_member_id: row.target_member_id,
          previous_value: row.previous_value,
          new_value: row.new_value,
          remarks: row.remarks,
          timestamp: row.timestamp,
        }
      : {
          // 18.8 limited Trustee projection: Activity, User, Date, Time only.
          audit_id: row.audit_id,
          module: row.module,
          action: row.action,
          performed_by_name: row.performed_by_name,
          timestamp: row.timestamp,
        },
  );

  return jsonSuccess({ records: shaped, total: count ?? shaped.length });
}

// FR-AUDIT-009: manual deletion is Supreme-Administrator-only and
// itself creates a new audit entry before the row is removed.
async function handleDelete(req: Request): Promise<Response> {
  const session = await requireEditorSession(req);
  if (!session.ok) return jsonError('Authentication required.', '401');

  if (!can(session.roleKey as never, 'audit_log', 'delete_record')) {
    return jsonError('You do not have permission to delete audit records.', '403');
  }

  let body: { auditId?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  const auditId = Number(body.auditId);
  if (!Number.isFinite(auditId)) return jsonError('auditId is required.', '400');
  if (typeof body.reason !== 'string' || body.reason.trim() === '') {
    return jsonError('A reason is required to delete an audit record.', '400');
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: fetchError } = await admin
    .from('audit_logs')
    .select('audit_id, module, action')
    .eq('audit_id', auditId)
    .single();
  if (fetchError || !target) return jsonError('Audit record not found.', '404');

  await recordAudit({
    module: 'System Administration',
    action: 'AUDIT_RECORD_DELETED',
    category: 'System Administration',
    performedBy: session.claims.sub,
    performedByName: session.claims.name,
    performedByRole: session.roleKey,
    remarks: `Deleted audit_id=${auditId} (${target.module}/${target.action}). Reason: ${body.reason.trim()}`,
  });

  const { error: deleteError } = await admin
    .from('audit_logs')
    .delete()
    .eq('audit_id', auditId);
  if (deleteError) {
    console.error('audit delete failed', deleteError);
    return jsonError('Delete failed.', '500');
  }

  return jsonSuccess(null, 'Audit record deleted.');
}
