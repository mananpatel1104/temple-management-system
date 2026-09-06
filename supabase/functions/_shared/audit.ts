import { getSupabaseAdmin } from './supabaseAdmin.ts';

export type AuditCategory =
  | 'Authentication'
  | 'Member Management'
  | 'Gallery'
  | 'Library'
  | 'Announcements'
  | 'Live Darshan'
  | 'Daily Thal'
  | 'Financial Records'
  | 'Panchang'
  | 'Nirnay'
  | 'Festival Calendar'
  | 'System Administration';

export interface AuditRecordInput {
  module: string;
  action: string;
  category: AuditCategory;
  performedBy: string | null; // member_id, null for anonymous/system events (e.g. failed login before identity is known)
  performedByName: string;
  performedByRole: string;
  targetMemberId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  remarks?: string;
}

/**
 * AuditLogger (SDD 4.12) — the single write path used by every Edge
 * Function so audit_logs always has a consistent shape (FR-AUDIT-001/
 * 002). PIN values must NEVER be passed in previousValue/newValue —
 * callers in this codebase never do so; see auth-change-pin/
 * auth-reset-pin for the pattern of recording *that* a PIN changed
 * without recording *what* it changed to (SEC-005/18.12).
 */
export async function recordAudit(entry: AuditRecordInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('audit_logs').insert({
    module: entry.module,
    action: entry.action,
    category: entry.category,
    performed_by: entry.performedBy,
    performed_by_name: entry.performedByName,
    performed_by_role: entry.performedByRole,
    target_member_id: entry.targetMemberId ?? null,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    remarks: entry.remarks ?? null,
  });

  if (error) {
    // Audit logging must never silently vanish (DP-008 / 18.2) but it
    // also must never crash the primary operation that already
    // succeeded (e.g. a PIN reset that worked) — log to the function's
    // own stderr so it surfaces in `supabase functions logs`.
    console.error('AUDIT LOG WRITE FAILED', error, entry);
  }
}
