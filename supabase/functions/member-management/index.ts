import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission, requireEditorSession } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import { can } from '../_shared/permissionMatrix.ts';
import { escapePostgrestFilterValue } from '../_shared/validation.ts';

/**
 * POST /member-management
 * Auth: Bearer <session_token>
 * Body: { action: 'list' | 'get' | 'changeRole' | 'setStatus' | 'updateNotes' | 'deleteMember', ...params }
 *
 * A single action-routed function (rather than one Edge Function per
 * verb) so RBAC (FR-MEM-005/006, PERM-006) and the "never expose mobile
 * numbers / private notes to non-Supreme-Administrators" rule
 * (FR-MEM-003/004) are enforced in exactly one place.
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
    case 'list':
      return handleList(req, body);
    case 'get':
      return handleGet(req, body);
    case 'changeRole':
      return handleChangeRole(req, body);
    case 'setStatus':
      return handleSetStatus(req, body);
    case 'updateNotes':
      return handleUpdateNotes(req, body);
    case 'deleteMember':
      return handleDeleteMember(req, body);
    default:
      return jsonError(`Unknown action "${action}".`, '400');
  }
});

// FR-MEM-011: search by Name, Member ID, Mobile Number, Role.
async function handleList(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'member_management', 'search_members');
  if (!auth.granted) return auth.response;

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const roleFilter = typeof body.role === 'string' ? body.role : undefined;
  const statusFilter = typeof body.status === 'string' ? body.status : undefined;
  const limit = Math.min(Number(body.limit ?? 50) || 50, 200);
  const offset = Number(body.offset ?? 0) || 0;

  const admin = getSupabaseAdmin();
  let dbQuery = admin
    .from('members')
    .select(
      'member_id, full_name, mobile_number, preferred_language, account_status, registration_date, last_active_date, roles(role_key, role_name)',
      { count: 'exact' },
    )
    .eq('is_deleted', false)
    .order('registration_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    // Task 12D: escape the free-text query before it is interpolated
    // into a raw PostgREST `.or(...)` filter expression, so characters
    // with special meaning in that grammar (comma, parentheses, quotes)
    // cannot inject additional filter clauses — see
    // escapePostgrestFilterValue()'s doc comment for the full rationale.
    const safeQuery = escapePostgrestFilterValue(query);
    dbQuery = dbQuery.or(
      `full_name.ilike.%${safeQuery}%,member_id.ilike.%${safeQuery}%,mobile_number.ilike.%${safeQuery}%`,
    );
  }
  if (statusFilter) {
    dbQuery = dbQuery.eq('account_status', statusFilter);
  }

  const { data, error, count } = await dbQuery;
  if (error) {
    console.error('member list failed', error);
    return jsonError('Search failed.', '500');
  }

  // deno-lint-ignore no-explicit-any
  let rows = (data ?? []) as any[];
  if (roleFilter) {
    rows = rows.filter((m) => m.roles?.role_key === roleFilter);
  }

  return jsonSuccess({
    members: rows.map((m) => ({
      member_id: m.member_id,
      full_name: m.full_name,
      mobile_number: m.mobile_number, // safe: this whole action requires search_members = SA-only
      preferred_language: m.preferred_language,
      account_status: m.account_status,
      registration_date: m.registration_date,
      last_active_date: m.last_active_date,
      role: m.roles?.role_key,
      role_name: m.roles?.role_name,
    })),
    total: count ?? rows.length,
  });
}

async function handleGet(req: Request, body: Record<string, unknown>): Promise<Response> {
  const memberId = body.memberId;
  if (typeof memberId !== 'string' || memberId.trim() === '') {
    return jsonError('memberId is required.', '400');
  }

  const session = await requireEditorSession(req);
  if (!session.ok) {
    return jsonError('Authentication required.', '401');
  }

  const isSelf = session.claims.sub === memberId;
  const isAdmin = can(session.roleKey as never, 'member_management', 'view_full_member_database');
  if (!isSelf && !isAdmin) {
    return jsonError('You do not have permission to view this profile.', '403');
  }

  const admin = getSupabaseAdmin();
  const { data: member, error } = await admin
    .from('members')
    .select(
      'member_id, full_name, mobile_number, preferred_language, private_notes, account_status, registration_date, last_active_date, must_change_pin, roles(role_key, role_name, requires_pin)',
    )
    .eq('member_id', memberId)
    .eq('is_deleted', false)
    .single();

  if (error || !member) return jsonError('Member not found.', '404');

  // deno-lint-ignore no-explicit-any
  const m = member as any;
  return jsonSuccess({
    member_id: m.member_id,
    full_name: m.full_name,
    // FR-MEM-003/004: mobile number and private notes are visible only
    // to the Supreme Administrator, never to the member viewing their
    // own profile via a lesser role and never to any other editor.
    mobile_number: isAdmin ? m.mobile_number : undefined,
    private_notes: isAdmin ? m.private_notes : undefined,
    // Preferred Language is not sensitive contact information (unlike
    // mobile_number/private_notes) so it is always returned, matching
    // how it is used purely for UI/i18n purposes.
    preferred_language: m.preferred_language,
    account_status: m.account_status,
    registration_date: m.registration_date,
    last_active_date: m.last_active_date,
    must_change_pin: m.must_change_pin,
    role: m.roles?.role_key,
    role_name: m.roles?.role_name,
    requires_pin: m.roles?.requires_pin,
  });
}

// FR-MEM-006/007, FR-ROLE-001..004, PERM-006: only the Supreme
// Administrator may change roles; content ownership is untouched.
async function handleChangeRole(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'member_management', 'assign_role');
  if (!auth.granted) return auth.response;

  const memberId = body.memberId;
  const newRoleKey = body.newRoleKey;
  if (typeof memberId !== 'string' || typeof newRoleKey !== 'string') {
    return jsonError('memberId and newRoleKey are required.', '400');
  }

  const admin = getSupabaseAdmin();

  const { data: target, error: targetError } = await admin
    .from('members')
    .select('member_id, full_name, role_id, roles(role_key)')
    .eq('member_id', memberId)
    .eq('is_deleted', false)
    .single();
  if (targetError || !target) return jsonError('Member not found.', '404');

  const { data: newRole, error: roleError } = await admin
    .from('roles')
    .select('role_id, role_key, requires_pin')
    .eq('role_key', newRoleKey)
    .single();
  if (roleError || !newRole) return jsonError('Unknown role.', '400');

  const previousRoleId = target.role_id;

  const { error: updateError } = await admin
    .from('members')
    .update({ role_id: newRole.role_id })
    .eq('member_id', memberId);
  if (updateError) {
    console.error('role change failed', updateError);
    return jsonError('Role change failed.', '500');
  }

  await admin.from('role_change_history').insert({
    member_id: memberId,
    previous_role_id: previousRoleId,
    new_role_id: newRole.role_id,
    changed_by: auth.claims.sub,
  });

  await recordAudit({
    module: 'Member Management',
    action: 'ROLE_CHANGED',
    category: 'Member Management',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    targetMemberId: memberId,
    // deno-lint-ignore no-explicit-any
    previousValue: { role: (target as any).roles?.role_key },
    newValue: { role: newRole.role_key },
    remarks: `Role changed for ${target.full_name} (${memberId}).`,
  });

  return jsonSuccess(
    {
      member_id: memberId,
      role: newRole.role_key,
      pin_required: newRole.requires_pin,
    },
    newRole.requires_pin
      ? 'Role updated. This role requires a PIN — create one via auth-reset-pin next.'
      : 'Role updated.',
  );
}

// 13.9 account_status transitions: Active / Locked / Suspended — SA only.
async function handleSetStatus(req: Request, body: Record<string, unknown>): Promise<Response> {
  const memberId = body.memberId;
  const status = body.status;
  if (typeof memberId !== 'string' || typeof status !== 'string') {
    return jsonError('memberId and status are required.', '400');
  }
  if (!['active', 'locked', 'suspended'].includes(status)) {
    return jsonError('status must be active, locked, or suspended.', '400');
  }

  const actionKey =
    status === 'locked' ? 'lock_account' : status === 'suspended' ? 'suspend_account' : 'unlock_account';
  const auth = await requirePermission(req, 'member_management', actionKey);
  if (!auth.granted) return auth.response;

  const admin = getSupabaseAdmin();
  const { data: target, error: fetchError } = await admin
    .from('members')
    .select('member_id, full_name, account_status')
    .eq('member_id', memberId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !target) return jsonError('Member not found.', '404');

  const { error: updateError } = await admin
    .from('members')
    .update({
      account_status: status,
      failed_pin_attempts: status === 'active' ? 0 : undefined,
      locked_at: status === 'locked' ? new Date().toISOString() : null,
    })
    .eq('member_id', memberId);
  if (updateError) {
    console.error('status change failed', updateError);
    return jsonError('Status change failed.', '500');
  }

  await recordAudit({
    module: 'Member Management',
    action:
      status === 'locked' ? 'ACCOUNT_LOCKED_BY_ADMIN' : status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_UNLOCKED',
    category: 'Member Management',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    targetMemberId: memberId,
    previousValue: { account_status: target.account_status },
    newValue: { account_status: status },
    remarks: `${target.full_name} (${memberId}) status set to ${status}.`,
  });

  return jsonSuccess({ member_id: memberId, account_status: status }, 'Status updated.');
}

// FR-MEM-012: private notes, Supreme Administrator only, never exposed elsewhere.
async function handleUpdateNotes(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'member_management', 'edit_private_notes');
  if (!auth.granted) return auth.response;

  const memberId = body.memberId;
  const notes = body.notes;
  if (typeof memberId !== 'string') return jsonError('memberId is required.', '400');
  if (notes !== null && typeof notes !== 'string') return jsonError('notes must be a string.', '400');
  if (typeof notes === 'string' && notes.length > 2000) return jsonError('notes too long.', '400');

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('members')
    .update({ private_notes: notes })
    .eq('member_id', memberId)
    .eq('is_deleted', false);
  if (error) return jsonError('Failed to update notes.', '500');

  await recordAudit({
    module: 'Member Management',
    action: 'PRIVATE_NOTES_UPDATED',
    category: 'Member Management',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    targetMemberId: memberId,
    remarks: 'Private note updated (note content itself is not duplicated into the audit log).',
  });

  return jsonSuccess(null, 'Notes updated.');
}

// FR-MEM-015/016: soft delete only, with confirmation expected client-side first.
async function handleDeleteMember(req: Request, body: Record<string, unknown>): Promise<Response> {
  const auth = await requirePermission(req, 'member_management', 'delete_member');
  if (!auth.granted) return auth.response;

  const memberId = body.memberId;
  if (typeof memberId !== 'string') return jsonError('memberId is required.', '400');
  if (memberId === auth.claims.sub) {
    return jsonError('You cannot delete your own account.', '400');
  }

  const admin = getSupabaseAdmin();
  const { data: target, error: fetchError } = await admin
    .from('members')
    .select('member_id, full_name')
    .eq('member_id', memberId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !target) return jsonError('Member not found.', '404');

  const { error: updateError } = await admin
    .from('members')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: auth.claims.sub,
      account_status: 'suspended',
    })
    .eq('member_id', memberId);
  if (updateError) {
    console.error('member delete failed', updateError);
    return jsonError('Delete failed.', '500');
  }

  await recordAudit({
    module: 'Member Management',
    action: 'MEMBER_DELETED',
    category: 'Member Management',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    targetMemberId: memberId,
    remarks: `${target.full_name} (${memberId}) deleted. Historical contributions retain this name (FR-MEM-016).`,
  });

  return jsonSuccess(null, 'Member deleted.');
}
