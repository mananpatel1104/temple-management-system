import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { issueSessionToken } from '../_shared/jwt.ts';
import { recordAudit } from '../_shared/audit.ts';
import { isNonEmptyString, validatePin } from '../_shared/validation.ts';

/**
 * Task 12D: this endpoint's documented intent (see file header) is an
 * EXACT case-insensitive name match — `.ilike()` was being used purely
 * as a case-insensitive equality check. But `ilike`'s pattern argument
 * treats `%`/`_` as SQL wildcards, so a name containing those
 * characters (or an attacker deliberately typing `%`) would match more
 * editor accounts than intended, up to and including every editor in
 * the system — turning "log in as a specific named editor" into "log
 * in as some/any editor whose PIN you can guess," without needing to
 * know anyone's real name. Escaping the two wildcard metacharacters
 * makes ilike behave as the exact-match-modulo-case comparison the
 * code already documents and relies on.
 */
function escapeIlikeWildcards(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

/**
 * POST /auth-login
 * Body: { fullName: string, pin: string }
 *
 * FR-AUTH-006/007/008/009 — Editor Login Screen submits Name + PIN.
 * SRS 6.5/14.4 explicitly specify Name (not Member ID) as the login
 * field, so lookup is by case-insensitive exact name match. Because
 * names are not guaranteed unique in the schema (SRS never requires
 * member-name uniqueness), a name that matches more than one editor
 * account is treated as an unresolvable login (the devotee/editor is
 * asked to contact the Supreme Administrator) rather than silently
 * picking one — this is documented as a known interaction between
 * FR-AUTH-006's field choice and FR-MEM's non-unique Name field in
 * docs/IMPLEMENTATION_CHECKLIST.md.
 *
 * Lockout: FR-AUTH-009 — configurable threshold (MAX_FAILED_ATTEMPTS),
 * defaulting to 5 (SDD 4.1 "BR-009"). On the threshold being reached the
 * account is set to Locked and an audit entry is written; only the
 * Supreme Administrator can unlock it (13.9).
 */

const MAX_FAILED_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  let body: { fullName?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  if (!isNonEmptyString(body.fullName)) {
    return jsonError('Name is required.', '400');
  }
  const pinError = validatePin(body.pin);
  if (pinError) return jsonError(pinError, '400');

  const fullName = (body.fullName as string).trim();
  const pin = body.pin as string;

  const admin = getSupabaseAdmin();

  const { data: candidates, error: lookupError } = await admin
    .from('members')
    .select(
      'member_id, full_name, pin_hash, failed_pin_attempts, account_status, must_change_pin, roles(role_key, role_name, requires_pin)',
    )
    .ilike('full_name', escapeIlikeWildcards(fullName));

  if (lookupError) {
    console.error('Editor login lookup failed', lookupError);
    return jsonError('Login is temporarily unavailable.', '500');
  }

  // deno-lint-ignore no-explicit-any
  const editors = (candidates ?? []).filter((m: any) => m.roles?.requires_pin);

  if (editors.length === 0) {
    return jsonError('Incorrect PIN. Please try again.', '401');
  }
  if (editors.length > 1) {
    return jsonError(
      'Multiple editor accounts share this name. Please contact the Supreme Administrator.',
      '409',
    );
  }

  // deno-lint-ignore no-explicit-any
  const editor = editors[0] as any;

  if (editor.account_status === 'locked') {
    return jsonError(
      'Too many incorrect attempts. Please contact the Supreme Administrator.',
      '423',
    );
  }
  if (editor.account_status === 'suspended') {
    return jsonError(
      'This editor account has been suspended. Please contact the Supreme Administrator.',
      '403',
    );
  }
  if (!editor.pin_hash) {
    return jsonError(
      'No PIN has been set for this account yet. Please contact the Supreme Administrator.',
      '403',
    );
  }

  const { data: pinValid } = await admin.rpc('pin_verify', {
    plain_pin: pin,
    stored_hash: editor.pin_hash,
  });

  if (!pinValid) {
    const nextAttempts = (editor.failed_pin_attempts ?? 0) + 1;
    const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

    await admin
      .from('members')
      .update({
        failed_pin_attempts: nextAttempts,
        account_status: shouldLock ? 'locked' : editor.account_status,
        locked_at: shouldLock ? new Date().toISOString() : null,
      })
      .eq('member_id', editor.member_id);

    await recordAudit({
      module: 'Authentication',
      action: shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      category: 'Authentication',
      performedBy: editor.member_id,
      performedByName: editor.full_name,
      performedByRole: editor.roles.role_key,
      targetMemberId: editor.member_id,
      remarks: shouldLock
        ? `Locked after ${nextAttempts} consecutive incorrect PIN attempts.`
        : `Incorrect PIN attempt ${nextAttempts} of ${MAX_FAILED_ATTEMPTS}.`,
    });

    return jsonError(
      shouldLock
        ? 'Too many incorrect attempts. Please contact the Supreme Administrator.'
        : 'Incorrect PIN. Please try again.',
      shouldLock ? '423' : '401',
    );
  }

  // Successful login — reset the failed-attempt counter and issue a
  // session token (FR-AUTH-007, SDD 4.1 SessionStore).
  await admin
    .from('members')
    .update({
      failed_pin_attempts: 0,
      last_active_date: new Date().toISOString(),
    })
    .eq('member_id', editor.member_id);

  const session = await issueSessionToken({
    memberId: editor.member_id,
    roleKey: editor.roles.role_key,
    fullName: editor.full_name,
  });

  await recordAudit({
    module: 'Authentication',
    action: 'EDITOR_LOGIN_SUCCESS',
    category: 'Authentication',
    performedBy: editor.member_id,
    performedByName: editor.full_name,
    performedByRole: editor.roles.role_key,
    targetMemberId: editor.member_id,
  });

  return jsonSuccess(
    {
      member_id: editor.member_id,
      full_name: editor.full_name,
      role: editor.roles.role_key,
      role_name: editor.roles.role_name,
      must_change_pin: editor.must_change_pin,
      session_token: session.token,
      expires_at: session.expiresAt,
    },
    'Login successful.',
  );
});
