import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { recordAudit } from '../_shared/audit.ts';
import {
  validateFullName,
  validateOptionalMobile,
  validatePreferredLanguage,
} from '../_shared/validation.ts';

/**
 * POST /auth-register
 * Body: { fullName: string, mobileNumber?: string, preferredLanguage: string }
 *
 * FR-AUTH-003/004/005, FR-MEM-001/002, SRS 22.4: registers a new
 * Devotee, auto-generating a permanent Member ID (DEV-00001 style) and
 * persisting the Preferred Language selected during the existing
 * Welcome-Screen language-selection flow (FR-AUTH-001/002) alongside
 * Name and Member ID. No PIN is ever created here — Devotees never
 * authenticate (ROLE-D-001).
 *
 * This endpoint is intentionally public (no session required): it is
 * the very first thing an installer of the app calls, before any
 * identity exists yet.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', '400', 405);
  }

  let body: { fullName?: unknown; mobileNumber?: unknown; preferredLanguage?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', '400');
  }

  const nameError = validateFullName(body.fullName);
  if (nameError) return jsonError(nameError, '400');

  const mobileError = validateOptionalMobile(body.mobileNumber);
  if (mobileError) return jsonError(mobileError, '400');

  const languageError = validatePreferredLanguage(body.preferredLanguage);
  if (languageError) return jsonError(languageError, '400');

  const fullName = (body.fullName as string).trim();
  const mobileNumber =
    typeof body.mobileNumber === 'string' && body.mobileNumber.trim() !== ''
      ? body.mobileNumber.trim()
      : null;
  const preferredLanguage = body.preferredLanguage as string;

  const admin = getSupabaseAdmin();

  const { data: devoteeRole, error: roleError } = await admin
    .from('roles')
    .select('role_id, role_key')
    .eq('role_key', 'devotee')
    .single();

  if (roleError || !devoteeRole) {
    console.error('Devotee role lookup failed', roleError);
    return jsonError('Registration is temporarily unavailable.', '500');
  }

  const { data: memberIdRow, error: idError } = await admin.rpc(
    'generate_member_id',
  );
  if (idError || !memberIdRow) {
    console.error('generate_member_id() failed', idError);
    return jsonError('Registration is temporarily unavailable.', '500');
  }
  const memberId = memberIdRow as string;

  const { data: inserted, error: insertError } = await admin
    .from('members')
    .insert({
      member_id: memberId,
      full_name: fullName,
      mobile_number: mobileNumber,
      preferred_language: preferredLanguage,
      role_id: devoteeRole.role_id,
      account_status: 'active',
    })
    .select('member_id, full_name, mobile_number, preferred_language, registration_date')
    .single();

  if (insertError || !inserted) {
    console.error('Member insert failed', insertError);
    return jsonError('Registration failed. Please try again.', '500');
  }

  await recordAudit({
    module: 'Member Management',
    action: 'MEMBER_REGISTERED',
    category: 'Member Management',
    performedBy: memberId,
    performedByName: fullName,
    performedByRole: 'devotee',
    targetMemberId: memberId,
    remarks: 'Self-registration via Welcome Screen.',
  });

  return jsonSuccess(
    {
      member_id: inserted.member_id,
      full_name: inserted.full_name,
      mobile_number: inserted.mobile_number,
      preferred_language: inserted.preferred_language,
      role: 'devotee',
      registration_date: inserted.registration_date,
    },
    'Registration successful.',
    201,
  );
});
