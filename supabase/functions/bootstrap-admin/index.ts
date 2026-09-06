import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { recordAudit } from '../_shared/audit.ts';
import {
  validateFullName,
  validatePin,
  validateOptionalMobile,
  validateOptionalPreferredLanguage,
} from '../_shared/validation.ts';

/**
 * Task 12D: plain `===` on a secret token is not constant-time — a
 * sufficiently patient network attacker could in principle exploit
 * comparison short-circuiting to recover BOOTSTRAP_SETUP_TOKEN one
 * byte at a time via timing differences. This endpoint is meant to be
 * called at most once (it refuses to run once a Supreme Administrator
 * exists), but it is public until that first call happens, so the
 * comparison is hardened to be constant-time regardless of where the
 * two strings first differ. Falls back to a length check plus a
 * dummy comparison against itself when lengths differ, so the
 * function never throws and never short-circuits on length alone.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(32).fill(7),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const [macA, macB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, aBytes),
    crypto.subtle.sign('HMAC', key, bBytes),
  ]);
  const viewA = new Uint8Array(macA);
  const viewB = new Uint8Array(macB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i]! ^ viewB[i]!;
  }
  return diff === 0;
}

/**
 * POST /bootstrap-admin
 * Body: { setupToken: string, fullName: string, pin: string, mobileNumber?: string }
 *
 * Task 9 §4 "Supreme Administrator Bootstrap": the SRS/SDD deliberately
 * leaves creation of the FIRST Supreme Administrator as a deployment
 * step with no self-service path (SDD 12.1: "The Supreme Administrator
 * role is assigned to a trusted individual before go-live, since no
 * self-service path exists to create the first administrator").
 *
 * This function is the safe, auditable implementation of that step:
 *   - It requires a one-time deployment secret, BOOTSTRAP_SETUP_TOKEN,
 *     that only the person deploying the project (not any end user)
 *     knows. Generate a long random value and set it with
 *     `supabase secrets set BOOTSTRAP_SETUP_TOKEN=...`, call this
 *     function once, then rotate/remove the secret so the endpoint can
 *     never be used again.
 *   - It refuses to run at all if a Supreme Administrator already
 *     exists (supreme_administrator_exists()), so it can never be used
 *     to create a second one or hijack the role.
 *   - No credential of any kind is hard-coded anywhere in source code —
 *     the setup token AND the initial PIN are both supplied by the
 *     deployer at call time.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  const expectedToken = Deno.env.get('BOOTSTRAP_SETUP_TOKEN');
  if (!expectedToken || expectedToken.length < 16) {
    return jsonError(
      'Bootstrap is not configured. Set the BOOTSTRAP_SETUP_TOKEN Edge Function secret to a long random value first.',
      '403',
    );
  }

  let body: {
    setupToken?: unknown;
    fullName?: unknown;
    pin?: unknown;
    mobileNumber?: unknown;
    preferredLanguage?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  if (typeof body.setupToken !== 'string' || !(await timingSafeEqual(body.setupToken, expectedToken))) {
    return jsonError('Invalid setup token.', '403');
  }

  const nameError = validateFullName(body.fullName);
  if (nameError) return jsonError(nameError, '400');
  const pinError = validatePin(body.pin);
  if (pinError) return jsonError(pinError, '400');
  const mobileError = validateOptionalMobile(body.mobileNumber);
  if (mobileError) return jsonError(mobileError, '400');
  // Preferred Language is optional here (unlike devotee self-registration):
  // the person running this one-time deployment step may not be going
  // through the app's Welcome Screen at all. Falls back to the members
  // table's 'gu' default (migration 0003) when omitted.
  const languageError = validateOptionalPreferredLanguage(body.preferredLanguage);
  if (languageError) return jsonError(languageError, '400');

  const admin = getSupabaseAdmin();

  const { data: alreadyExists, error: existsError } = await admin.rpc(
    'supreme_administrator_exists',
  );
  if (existsError) {
    console.error('supreme_administrator_exists() failed', existsError);
    return jsonError('Bootstrap check failed.', '500');
  }
  if (alreadyExists) {
    return jsonError(
      'A Supreme Administrator already exists. Bootstrap can only run once.',
      '409',
    );
  }

  const { data: saRole, error: roleError } = await admin
    .from('roles')
    .select('role_id')
    .eq('role_key', 'supreme_administrator')
    .single();
  if (roleError || !saRole) {
    console.error('Supreme Administrator role lookup failed', roleError);
    return jsonError('Bootstrap failed: role configuration missing.', '500');
  }

  const { data: memberId, error: idError } = await admin.rpc(
    'generate_member_id',
  );
  if (idError || !memberId) {
    console.error('generate_member_id() failed', idError);
    return jsonError('Bootstrap failed.', '500');
  }

  const { data: pinHash, error: hashError } = await admin.rpc('pin_hash', {
    plain_pin: body.pin,
  });
  if (hashError || !pinHash) {
    console.error('pin_hash() failed', hashError);
    return jsonError('Bootstrap failed.', '500');
  }

  const fullName = (body.fullName as string).trim();
  const mobileNumber =
    typeof body.mobileNumber === 'string' && body.mobileNumber.trim() !== ''
      ? body.mobileNumber.trim()
      : null;
  const preferredLanguage =
    typeof body.preferredLanguage === 'string' && body.preferredLanguage.trim() !== ''
      ? body.preferredLanguage.trim()
      : undefined; // omitted -> DB default 'gu' (migration 0003)

  const { error: insertError } = await admin.from('members').insert({
    member_id: memberId,
    full_name: fullName,
    mobile_number: mobileNumber,
    ...(preferredLanguage ? { preferred_language: preferredLanguage } : {}),
    role_id: saRole.role_id,
    pin_hash: pinHash,
    pin_last_changed_at: new Date().toISOString(),
    must_change_pin: true,
    account_status: 'active',
  });

  if (insertError) {
    console.error('Supreme Administrator creation failed', insertError);
    return jsonError('Bootstrap failed.', '500');
  }

  await recordAudit({
    module: 'System Administration',
    action: 'SUPREME_ADMINISTRATOR_BOOTSTRAPPED',
    category: 'System Administration',
    performedBy: memberId as string,
    performedByName: fullName,
    performedByRole: 'supreme_administrator',
    targetMemberId: memberId as string,
    remarks: 'Initial Supreme Administrator account created via deployment bootstrap.',
  });

  return jsonSuccess(
    { member_id: memberId, full_name: fullName },
    'Supreme Administrator created. Remove or rotate BOOTSTRAP_SETUP_TOKEN now.',
    201,
  );
});
