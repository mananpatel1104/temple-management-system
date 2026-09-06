import { functionsClient } from '@shared/lib/functionsClient';
import type { AuditCategory, AuditRecord } from '../types/audit.types';

/**
 * AuditQueryController-equivalent client service (SDD 4.12). The Edge
 * Function itself shapes the response per role (18.8) — this service
 * never tries to filter fields client-side, since a Trustee's browser
 * must never even receive the restricted fields in the first place.
 */
export const auditService = {
  async query(
    sessionToken: string,
    params: {
      query?: string;
      module?: string;
      category?: AuditCategory;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ records: AuditRecord[]; total: number }> {
    return functionsClient.get(
      'audit-log',
      {
        query: params.query,
        module: params.module,
        category: params.category,
        from: params.from,
        to: params.to,
        limit: params.limit?.toString(),
        offset: params.offset?.toString(),
      },
      sessionToken,
    );
  },

  /** FR-AUDIT-009 — exceptional, Supreme Administrator only, itself audited. */
  async deleteRecord(sessionToken: string, auditId: number, reason: string): Promise<void> {
    await functionsClient.post('audit-log', { auditId, reason }, sessionToken);
  },
};
