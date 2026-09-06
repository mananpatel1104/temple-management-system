import { useEffect, useState } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { memberService } from '../services/memberService';
import type { AccountStatus, MemberDetail, MemberListItem } from '../types/member.types';
import type { RoleKey } from '@modules/roles-permissions/types/roles.types';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@modules/roles-permissions/config/roleLabels.config';
import { ApiError } from '@shared/lib/functionsClient';
import { LANGUAGE_NATIVE_NAMES } from '@config/app.config';

/**
 * Member Management screen (SRS Chapter 13). Route-guarded to the
 * Supreme Administrator by RequirePermission(member_management,
 * search_members) in AppRouter. A master-detail layout: search results
 * on top, the selected member's admin actions below.
 */
export function MemberManagementScreen() {
  const { t } = useLanguage();
  const { editorSession } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<MemberListItem[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [newPin, setNewPin] = useState('');

  const runSearch = async (query?: string) => {
    if (!editorSession) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await memberService.search(editorSession.sessionToken, { query, limit: 100 });
      setResults(result.members);
    } catch (error) {
      setSearchError(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSession?.sessionToken]);

  const selectMember = async (memberId: string) => {
    if (!editorSession) return;
    setDetailError(null);
    setActionMessage(null);
    try {
      const detail = await memberService.get(editorSession.sessionToken, memberId);
      setSelected(detail);
      setNotesDraft(detail.private_notes ?? '');
      setNewPin('');
    } catch (error) {
      setDetailError(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setIsBusy(true);
    setActionMessage(null);
    setDetailError(null);
    try {
      await fn();
    } catch (error) {
      setDetailError(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRoleChange = (newRole: RoleKey) =>
    withBusy(async () => {
      if (!editorSession || !selected) return;
      const result = await memberService.changeRole(editorSession.sessionToken, selected.member_id, newRole);
      await selectMember(selected.member_id);
      await runSearch(searchTerm || undefined);
      setActionMessage(
        result.pin_required ? t('memberManagement.roleChangedPinRequired') : t('memberManagement.roleChanged'),
      );
    });

  const handleStatusChange = (status: AccountStatus) =>
    withBusy(async () => {
      if (!editorSession || !selected) return;
      await memberService.setStatus(editorSession.sessionToken, selected.member_id, status);
      await selectMember(selected.member_id);
      await runSearch(searchTerm || undefined);
      setActionMessage(t('memberManagement.statusUpdated'));
    });

  const handleNotesSave = () =>
    withBusy(async () => {
      if (!editorSession || !selected) return;
      await memberService.updateNotes(editorSession.sessionToken, selected.member_id, notesDraft);
      setActionMessage(t('memberManagement.notesSaved'));
    });

  const handlePinReset = () =>
    withBusy(async () => {
      if (!editorSession || !selected) return;
      if (!/^\d{4,6}$/.test(newPin)) {
        setDetailError(t('memberManagement.pinFormatError'));
        return;
      }
      await memberService.resetPin(editorSession.sessionToken, selected.member_id, newPin);
      setNewPin('');
      setActionMessage(t('memberManagement.pinReset'));
    });

  const handleDelete = () =>
    withBusy(async () => {
      if (!editorSession || !selected) return;
      if (!window.confirm(t('memberManagement.confirmDelete'))) return;
      await memberService.deleteMember(editorSession.sessionToken, selected.member_id);
      setSelected(null);
      await runSearch(searchTerm || undefined);
      setActionMessage(t('memberManagement.memberDeleted'));
    });

  return (
    <section className="flex flex-1 flex-col gap-4 px-1 py-6">
      <h1 className="text-center text-app-xl font-bold text-saffron">{t('memberManagement.title')}</h1>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(searchTerm.trim() || undefined);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t('memberManagement.searchPlaceholder')}
          className="flex-1 rounded-card border border-black/10 bg-surface-light px-4 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
        <button type="submit" className="rounded-card bg-saffron px-4 py-2 text-app-base font-semibold text-white">
          {t('auditLog.search')}
        </button>
      </form>

      {searchError && (
        <p role="alert" className="text-center text-app-sm text-danger">
          {searchError}
        </p>
      )}

      {isSearching ? (
        <p className="text-center text-app-sm text-text-secondary">{t('common.loading')}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {results.map((member) => (
            <li key={member.member_id}>
              <button
                type="button"
                onClick={() => void selectMember(member.member_id)}
                className={`flex w-full items-center justify-between rounded-card border border-black/10 px-3 py-2 text-left text-app-sm dark:border-white/10 ${
                  selected?.member_id === member.member_id ? 'bg-saffron/10' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                <span className="text-text-primary">
                  {member.full_name}{' '}
                  <span className="text-text-secondary">({member.member_id})</span>
                </span>
                <span className="text-text-secondary">{ROLE_LABELS[member.role]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="rounded-card border border-black/10 bg-cream/40 p-4 dark:border-white/10 dark:bg-surface-dark">
          <h2 className="text-app-lg font-semibold text-text-primary">
            {selected.full_name} <span className="text-app-sm text-text-secondary">({selected.member_id})</span>
          </h2>
          {selected.mobile_number !== undefined && (
            <p className="text-app-sm text-text-secondary">
              {t('memberManagement.mobile')}: {selected.mobile_number || t('memberManagement.notProvided')}
            </p>
          )}
          <p className="text-app-sm text-text-secondary">
            {t('memberManagement.preferredLanguage')}: {LANGUAGE_NATIVE_NAMES[selected.preferred_language]}
          </p>
          <p className="text-app-sm text-text-secondary">
            {t('memberManagement.status')}: {selected.account_status}
          </p>

          {detailError && (
            <p role="alert" className="mt-2 text-app-sm text-danger">
              {detailError}
            </p>
          )}
          {actionMessage && <p className="mt-2 text-app-sm text-success">{actionMessage}</p>}

          {/* Role assignment — FR-MEM-006/007 */}
          <div className="mt-4">
            <label htmlFor="role-select" className="block text-app-sm font-medium text-text-secondary">
              {t('memberManagement.role')}
            </label>
            <select
              id="role-select"
              value={selected.role}
              disabled={isBusy}
              onChange={(event) => void handleRoleChange(event.target.value as RoleKey)}
              className="mt-1 w-full rounded-card border border-black/10 bg-surface-light px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          {/* Account status — 13.9 */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isBusy || selected.account_status === 'active'}
              onClick={() => void handleStatusChange('active')}
              className="flex-1 rounded-card border border-black/10 px-3 py-2 text-app-sm text-text-primary disabled:opacity-50 dark:border-white/10"
            >
              {t('memberManagement.activate')}
            </button>
            <button
              type="button"
              disabled={isBusy || selected.account_status === 'locked'}
              onClick={() => void handleStatusChange('locked')}
              className="flex-1 rounded-card border border-black/10 px-3 py-2 text-app-sm text-text-primary disabled:opacity-50 dark:border-white/10"
            >
              {t('memberManagement.lock')}
            </button>
            <button
              type="button"
              disabled={isBusy || selected.account_status === 'suspended'}
              onClick={() => void handleStatusChange('suspended')}
              className="flex-1 rounded-card border border-black/10 px-3 py-2 text-app-sm text-text-primary disabled:opacity-50 dark:border-white/10"
            >
              {t('memberManagement.suspend')}
            </button>
          </div>

          {/* PIN reset — FR-MEM-010, only relevant to editor roles */}
          {selected.requires_pin && (
            <div className="mt-4">
              <label htmlFor="new-pin" className="block text-app-sm font-medium text-text-secondary">
                {t('memberManagement.resetPin')}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="new-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newPin}
                  onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 rounded-card border border-black/10 bg-surface-light px-3 py-2 text-center text-app-base tracking-[0.4em] text-text-primary dark:border-white/10 dark:bg-surface-dark"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handlePinReset()}
                  className="rounded-card bg-saffron px-4 py-2 text-app-sm font-semibold text-white disabled:opacity-60"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          )}

          {/* Private notes — FR-MEM-004/012, Supreme Administrator only */}
          <div className="mt-4">
            <label htmlFor="private-notes" className="block text-app-sm font-medium text-text-secondary">
              {t('memberManagement.privateNotes')}
            </label>
            <textarea
              id="private-notes"
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-card border border-black/10 bg-surface-light px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleNotesSave()}
              className="mt-2 rounded-card border border-black/10 px-4 py-2 text-app-sm text-text-primary disabled:opacity-60 dark:border-white/10"
            >
              {t('common.save')}
            </button>
          </div>

          {/* Delete — FR-MEM-015/016 */}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleDelete()}
            className="mt-6 w-full rounded-card border border-danger px-4 py-2 text-app-sm font-semibold text-danger disabled:opacity-60"
          >
            {t('memberManagement.deleteMember')}
          </button>
        </div>
      )}
    </section>
  );
}
