export type AuditCategory =
  | 'Authentication'
  | 'Member Management'
  | 'Gallery'
  | 'Library'
  | 'Announcements'
  | 'Daily Thal'
  | 'Financial Records'
  | 'Panchang'
  | 'Nirnay'
  | 'Festival Calendar'
  | 'System Administration';

/** Full record — Supreme Administrator only (18.8). */
export interface AuditRecordFull {
  audit_id: number;
  module: string;
  action: string;
  category: AuditCategory;
  performed_by: string | null;
  performed_by_name: string;
  performed_by_role: string;
  target_member_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  remarks: string | null;
  timestamp: string;
}

/** Limited projection — Trustee only (18.8: "Activity, User Name, Date, Time only"). */
export interface AuditRecordLimited {
  audit_id: number;
  module: string;
  action: string;
  performed_by_name: string;
  timestamp: string;
}

export type AuditRecord = AuditRecordFull | AuditRecordLimited;

export function isFullAuditRecord(record: AuditRecord): record is AuditRecordFull {
  return 'category' in record;
}
