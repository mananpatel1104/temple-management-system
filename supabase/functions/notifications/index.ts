import { handleCorsPreflight } from '../_shared/cors.ts';
import { jsonError, jsonSuccess } from '../_shared/response.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { resolveOptionalEditorRole } from '../_shared/rbac.ts';
import { isNonEmptyString } from '../_shared/validation.ts';

/**
 * POST /notifications
 * Body: { action: 'list' | 'markRead', ...params }
 *
 * Notification Module (SRS 12.10 FR-NOT-001..003, 23.17, 24.16; SDD 4.7
 * NotificationDispatcher, 5.4 notifications table). Notification RECORDS
 * are created exclusively by the database trigger in migration 0006
 * (trg_announcements_notify_on_publish) — this function only ever reads
 * a member's own notifications and updates their own read state; it
 * never inserts notifications, so recipient/visibility eligibility
 * (FR-NOT-003) can never drift between two independent code paths.
 *
 * ===================================================================
 * IDENTITY / OWNERSHIP — the Devotee-identity trust boundary
 * ===================================================================
 * This project's Auth model (SRS Chapter 14, `_shared/jwt.ts`) issues a
 * signed session token ONLY to editor roles (Bhakti Mandal Head,
 * Shreeji Yuvak Mandal Head, Trustee, Supreme Administrator) on PIN
 * login. Devotees never authenticate at all (SRS 14.1: no OTP/password/
 * session, ROLE-D-001) — the only identity a Devotee has anywhere in
 * this application is the member_id issued once at registration
 * (`auth-register`) and stored client-side, with nothing cryptographic
 * backing it. That is an existing, deliberate app-wide design decision
 * from Task 9, not something introduced by this module.
 *
 * Because notifications are inherently per-recipient (SDD 5.4
 * member_id FK), this function resolves "who is asking" as follows:
 *   1. If a valid editor Bearer session is present, its `sub` claim
 *      (cryptographically verified) is used — this is the strong case
 *      and covers every editor role.
 *   2. Otherwise, the caller must supply `memberId` in the request body.
 *      This value is looked up and REQUIRED to belong to an active
 *      Devotee-role member — a self-declared id can never claim an
 *      editor role's identity (that path only works via #1), so this
 *      cannot be used to escalate privilege. It CAN, in principle, let
 *      one Devotee read/mark-read another Devotee's notifications if
 *      they know/guess that Devotee's member_id, exactly to the same
 *      degree the existing app already trusts a Devotee's self-reported
 *      identity everywhere else (e.g. nothing server-side stops a
 *      Devotee's browser from claiming any member_id it likes today —
 *      there is simply no stronger Devotee identity primitive anywhere
 *      in the current SRS/SDD to build on). This is flagged explicitly
 *      in docs/IMPLEMENTATION_CHECKLIST.md and the Task 10C final report
 *      as a known limitation inherited from the existing Auth
 *      architecture, not invented here — closing it would require a new
 *      SRS/SDD-specified Devotee identity mechanism, which is out of
 *      this task's scope ("do not invent requirements").
 * ===================================================================
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
    case 'markRead':
      return handleMarkRead(req, body);
    default:
      return jsonError(`Unknown action "${action}".`, '400');
  }
});

/** See file header "IDENTITY / OWNERSHIP" for the full trust-boundary rationale. */
async function resolveRecipientMemberId(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ ok: true; memberId: string } | { ok: false; response: Response }> {
  const editorSession = await resolveOptionalEditorRole(req);
  if (editorSession) {
    return { ok: true, memberId: editorSession.memberId };
  }

  const claimedMemberId = body.memberId;
  if (!isNonEmptyString(claimedMemberId)) {
    return {
      ok: false,
      response: jsonError('memberId is required when not signed in as an editor.', '400'),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from('members')
    .select('member_id, account_status, roles(role_key)')
    .eq('member_id', claimedMemberId)
    .maybeSingle();

  // deno-lint-ignore no-explicit-any
  const roleKey = (member as any)?.roles?.role_key as string | undefined;

  if (!member || member.account_status !== 'active' || roleKey !== 'devotee') {
    // Deliberately generic: does not reveal whether the id exists, is an
    // editor account, or is locked/suspended.
    return { ok: false, response: jsonError('Unable to resolve member identity.', '401') };
  }

  return { ok: true, memberId: claimedMemberId };
}

// FR-NOT: "Get Notifications" — SRS 23.17. Newest first; grouping by
// date (SRS 24.16) is a presentation concern handled client-side.
async function handleList(req: Request, body: Record<string, unknown>): Promise<Response> {
  const recipient = await resolveRecipientMemberId(req, body);
  if (!recipient.ok) return recipient.response;

  const limitRaw = body.limit;
  const limit = typeof limitRaw === 'number' && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 50;

  const admin = getSupabaseAdmin();
  const { data, error, count } = await admin
    .from('notifications')
    .select('notification_id, title, reference_type, reference_id, is_read, created_at', {
      count: 'exact',
    })
    .eq('member_id', recipient.memberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('notifications list failed', error);
    return jsonError('Unable to load notifications.', '500');
  }

  const { count: unreadCount, error: unreadError } = await admin
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('member_id', recipient.memberId)
    .eq('is_read', false);

  if (unreadError) {
    console.error('notifications unread count failed', unreadError);
  }

  return jsonSuccess({
    notifications: data ?? [],
    total: count ?? (data?.length ?? 0),
    unread_count: unreadError ? null : unreadCount ?? 0,
  });
}

// FR-NOT / SRS 23.17 "Mark as Read" — PUT /api/notifications/read/{id}
// in the SRS's abstract API list; implemented as an action on this
// project's single action-routed function, matching the
// announcements/member-management convention (see those files' header
// comments). Ownership is enforced by scoping the update to
// (notification_id = id AND member_id = resolvedMemberId) — a
// mismatched/foreign id updates zero rows and is reported as not found,
// never silently succeeding against someone else's notification.
async function handleMarkRead(req: Request, body: Record<string, unknown>): Promise<Response> {
  const recipient = await resolveRecipientMemberId(req, body);
  if (!recipient.ok) return recipient.response;

  const id = body.id;
  if (!isNonEmptyString(id)) {
    return jsonError('id is required.', '400');
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('notification_id', id)
    .eq('member_id', recipient.memberId)
    .select('notification_id, is_read')
    .maybeSingle();

  if (error) {
    console.error('notifications markRead failed', error);
    return jsonError('Unable to update notification.', '500');
  }

  if (!data) {
    // Either the id does not exist, or it belongs to a different
    // member — both are reported identically (no ownership oracle).
    return jsonError('Notification not found.', '404');
  }

  return jsonSuccess({ notification_id: data.notification_id, is_read: data.is_read }, 'Marked as read.');
}
