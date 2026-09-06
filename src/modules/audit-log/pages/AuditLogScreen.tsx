import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { auditService } from '../services/auditService';
import { isFullAuditRecord, type AuditRecord } from '../types/audit.types';
import { ApiError } from '@shared/lib/functionsClient';

/**
 * Audit Log & Activity History screen (SRS Chapter 18). Route-guarded by
 * RequirePermission(audit_log, view_limited|view_full) in AppRouter, so
 * only Trustees and the Supreme Administrator ever reach this component
 * — but the Edge Function re-shapes every row regardless (18.8), so even
 * a bypassed guard could never leak restricted fields to a Trustee.
 */
export function AuditLogScreen() {
  const { t } = useLanguage();
  const { editorSession } = useAuth();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async (query?: string) => {
    if (!editorSession) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await auditService.query(editorSession.sessionToken, { query, limit: 100 });
      setRecords(result.records);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSession?.sessionToken]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    void load(searchTerm.trim() || undefined);
  };

  return (
    <section className="flex flex-1 flex-col gap-4 px-1 py-6">
      <h1 className="text-center text-app-xl font-bold text-saffron">{t('auditLog.title')}</h1>

      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t('auditLog.searchPlaceholder')}
          className="flex-1 rounded-card border border-black/10 bg-surface-light px-4 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
        <button
          type="submit"
          className="rounded-card bg-saffron px-4 py-2 text-app-base font-semibold text-white"
        >
          {t('auditLog.search')}
        </button>
      </form>

      {errorMessage && (
        <p role="alert" className="text-center text-app-sm text-danger">
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <p className="text-center text-app-sm text-text-secondary">{t('common.loading')}</p>
      ) : records.length === 0 ? (
        <p className="text-center text-app-sm text-text-secondary">{t('auditLog.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((record) => (
            <li
              key={record.audit_id}
              className="rounded-card border border-black/10 bg-cream/40 p-3 dark:border-white/10 dark:bg-surface-dark"
            >
              <div className="flex items-center justify-between">
                <span className="text-app-sm font-semibold text-text-primary">{record.action}</span>
                <span className="text-app-sm text-text-secondary">
                  {new Date(record.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-app-sm text-text-secondary">
                {record.module} · {record.performed_by_name}
              </p>
              {isFullAuditRecord(record) && record.remarks && (
                <p className="mt-1 text-app-sm text-text-secondary">{record.remarks}</p>
              )}
              {isFullAuditRecord(record) &&
                (record.previous_value !== null || record.new_value !== null) && (
                  <p className="mt-1 break-words text-app-sm text-text-secondary">
                    {record.previous_value !== null && (
                      <>
                        {t('auditLog.previousValue')}: {JSON.stringify(record.previous_value)}{' '}
                      </>
                    )}
                    {record.new_value !== null && (
                      <>
                        {t('auditLog.newValue')}: {JSON.stringify(record.new_value)}
                      </>
                    )}
                  </p>
                )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
