import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import { validatePin } from '../_shared/validation.ts';

/**
 * PUT /auth-reset-pin
 * Auth: Bearer <session_token> (Supreme Administrator only)
 * Body: { memberId: string, newPin: string }
 *
 * FR-AUTH-006 (initial PIN creation for a newly-promoted editor) and
 * FR-AUTH-010 / FR-MEM-010 (forgotten-PIN reset — no self-service path
 * exists). Also used to create the FIRST pin for an editor role
 * promoted via member-management/changeRole.
 *
 * FR-MEM-010: "Resetting shall not delete uploaded photos,
 * announcements, gallery albums, Daily Darshan, Daily Thal records, or
 * audit history." This endpoint only ever touches the members row's PIN
 * fields, never any content table, satisfying that requirement by
 * construction.
 *
 * Also clears any existing lockout (failed_pin_attempts / Locked
 * status) so a reset PIN is immediately usable, per 13.9 "only Supreme
 * Administrator may remove" a Locked status.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  const auth = await requirePermission(req, 'auth', 'reset_pin');
  if (!auth.granted) return auth.response;

  let body: { memberId?: unknown; newPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  if (typeof body.memberId !== 'string' || body.memberId.trim() === '') {
    return jsonError('memberId is required.', '400');
  }
  const pinError = validatePin(body.newPin);
  if (pinError) return jsonError(pinError, '400');

  const admin = getSupabaseAdmin();
  const targetId = body.memberId.trim();

  const { data: target, error: fetchError } = await admin
    .from('members')
    .select('member_id, full_name, account_status, roles(role_key, requires_pin)')
    .eq('member_id', targetId)
    .single();

  if (fetchError || !target) {
    return jsonError('Member not found.', '404');
  }

  // deno-lint-ignore no-explicit-any
  if (!(target as any).roles?.requires_pin) {
    return jsonError(
      'This member does not hold an editor role and cannot receive a PIN.',
      '400',
    );
  }

  // Task 12D: 13.9 gives account_status three states (Active/Locked/
  // Suspended), each with its own SA-only transition in the
  // member-management `setStatus` action. A PIN reset should clear a
  // *lockout* (that is what this endpoint is for — FR-AUTH-010/
  // FR-MEM-010 forgotten-PIN reset), but it must not silently undo a
  // separate, deliberate Suspension — that requires an explicit
  // setStatus call. Previously this endpoint unconditionally forced
  // account_status back to 'active', which meant resetting a suspended
  // editor's PIN also un-suspended them as an unintended side effect.
  const nextAccountStatus = target.account_status === 'suspended' ? 'suspended' : 'active';

  const { data: newHash } = await admin.rpc('pin_hash', {
    plain_pin: body.newPin,
  });

  const { error: updateError } = await admin
    .from('members')
    .update({
      pin_hash: newHash,
      pin_last_changed_at: new Date().toISOString(),
      must_change_pin: true, // editor should choose their own PIN after this forced reset
      failed_pin_attempts: 0,
      account_status: nextAccountStatus,
      locked_at: null,
    })
    .eq('member_id', targetId);

  if (updateError) {
    console.error('PIN reset failed', updateError);
    return jsonError('PIN reset failed. Please try again.', '500');
  }

  await recordAudit({
    module: 'Authentication',
    action: 'PIN_RESET_BY_ADMIN',
    category: 'Authentication',
    performedBy: auth.claims.sub,
    performedByName: auth.claims.name,
    performedByRole: auth.roleKey,
    targetMemberId: targetId,
    remarks: `Supreme Administrator reset the PIN for ${target.full_name} (${targetId}).`,
  });

  return jsonSuccess(null, 'PIN reset successfully. The editor must change it after logging in.');
});
