import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requirePermission } from '../_shared/rbac.ts';
import { recordAudit } from '../_shared/audit.ts';
import { validatePin } from '../_shared/validation.ts';

/**
 * PUT /auth-change-pin
 * Auth: Bearer <session_token> (any editor)
 * Body: { currentPin: string, newPin: string }
 *
 * FR-MEM-009 — "editors may change their own PIN after their first
 * successful login." The current PIN must be re-verified so a
 * momentarily-unlocked device cannot be used to silently take over an
 * editor's PIN.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'PUT' && req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  const auth = await requirePermission(req, 'auth', 'change_own_pin');
  if (!auth.granted) return auth.response;

  let body: { currentPin?: unknown; newPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  const currentPinError = validatePin(body.currentPin);
  if (currentPinError) return jsonError(`Current PIN: ${currentPinError}`, '400');
  const newPinError = validatePin(body.newPin);
  if (newPinError) return jsonError(`New PIN: ${newPinError}`, '400');

  if (body.currentPin === body.newPin) {
    return jsonError('New PIN must be different from the current PIN.', '400');
  }

  const admin = getSupabaseAdmin();
  const memberId = auth.claims.sub;

  const { data: member, error: fetchError } = await admin
    .from('members')
    .select('member_id, full_name, pin_hash')
    .eq('member_id', memberId)
    .single();

  if (fetchError || !member) {
    return jsonError('Account not found.', '404');
  }

  const { data: currentValid } = await admin.rpc('pin_verify', {
    plain_pin: body.currentPin,
    stored_hash: member.pin_hash,
  });

  if (!currentValid) {
    return jsonError('Current PIN is incorrect.', '401');
  }

  const { data: newHash } = await admin.rpc('pin_hash', {
    plain_pin: body.newPin,
  });

  const { error: updateError } = await admin
    .from('members')
    .update({
      pin_hash: newHash,
      pin_last_changed_at: new Date().toISOString(),
      must_change_pin: false,
    })
    .eq('member_id', memberId);

  if (updateError) {
    console.error('PIN change failed', updateError);
    return jsonError('PIN change failed. Please try again.', '500');
  }

  await recordAudit({
    module: 'Authentication',
    action: 'PIN_CHANGED_SELF',
    category: 'Authentication',
    performedBy: memberId,
    performedByName: member.full_name,
    performedByRole: auth.roleKey,
    targetMemberId: memberId,
    remarks: 'Editor changed their own PIN.', // never logs the PIN value itself (SEC-005)
  });

  return jsonSuccess(null, 'PIN changed successfully.');
});
