import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { ApiError } from '@shared/lib/functionsClient';
import { announcementService } from '../services/announcementService';
import { AnnouncementPriorityBadge } from '../components/AnnouncementPriorityBadge';
import { AnnouncementCategoryBadge } from '../components/AnnouncementCategoryBadge';
import { CreateEditAnnouncementDialog } from '../components/CreateEditAnnouncementDialog';
import type { Announcement } from '../types/announcement.types';

/** Announcement detail route (`/announcements/:id`, SRS 12.16). */
export function AnnouncementDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { hasPermission, editorSession } = useAuth();
  const navigate = useNavigate();

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await announcementService.get(id, editorSession?.sessionToken);
      setAnnouncement(result);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('announcements.errors.notFound'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return null;

  // Task 12B: `created_by` is now only returned by the API to
  // authenticated editors (never to anonymous/Devotee viewers), so
  // guard against both sides being null/undefined coincidentally
  // matching — ownership only ever counts when both ids are present.
  const isOwner =
    Boolean(announcement?.created_by) &&
    Boolean(editorSession?.memberId) &&
    announcement?.created_by === editorSession?.memberId;
  const canEditAny = hasPermission('announcements', 'edit_any');
  const canEditOwn = hasPermission('announcements', 'edit_own') && isOwner;
  const canEdit = canEditAny || canEditOwn;

  const canArchiveAny = hasPermission('announcements', 'archive_any');
  const canArchiveOwn = hasPermission('announcements', 'archive_own') && isOwner;
  const canArchive = canArchiveAny || canArchiveOwn;
  const canRestore = hasPermission('announcements', 'restore');

  const canDeleteAny = hasPermission('announcements', 'delete_any');
  const canDeleteOwn = hasPermission('announcements', 'delete_own') && isOwner;
  const canDelete = canDeleteAny || canDeleteOwn;

  const handleArchiveToggle = async () => {
    if (!announcement || !editorSession) return;
    const nextArchived = !announcement.is_archived;
    const confirmMessage = nextArchived
      ? t('announcements.confirmArchive')
      : t('announcements.confirmRestore');
    if (!window.confirm(confirmMessage)) return;
    setIsBusy(true);
    try {
      if (nextArchived) {
        await announcementService.archive(editorSession.sessionToken, announcement.announcement_id, true);
      } else {
        await announcementService.restore(editorSession.sessionToken, announcement.announcement_id);
      }
      void load();
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('announcements.errors.generic'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!announcement || !editorSession) return;
    if (!window.confirm(t('announcements.confirmDelete'))) return;
    setIsBusy(true);
    try {
      await announcementService.remove(editorSession.sessionToken, announcement.announcement_id);
      navigate('/announcements', { replace: true });
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('announcements.errors.generic'));
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Link to="/announcements" className="mb-4 inline-flex w-fit items-center gap-1 text-app-base font-medium text-saffron">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {t('announcements.backToAnnouncements')}
      </Link>

      {isLoading ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : loadError || !announcement ? (
        <p role="alert" className="text-app-base text-danger">
          {loadError ?? t('announcements.errors.notFound')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <AnnouncementCategoryBadge category={announcement.category} />
            <AnnouncementPriorityBadge priority={announcement.priority} />
            {announcement.status === 'scheduled' && (
              <span className="inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-app-sm text-text-secondary dark:bg-white/10">
                {t('announcements.status.scheduled')}
              </span>
            )}
            {announcement.is_archived && (
              <span className="inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-app-sm text-text-secondary dark:bg-white/10">
                {t('announcements.status.archived')}
              </span>
            )}
          </div>

          <h1 className="text-app-xl font-bold text-text-primary">{announcement.title}</h1>

          <p className="whitespace-pre-wrap text-app-base text-text-primary">{announcement.description}</p>

          {announcement.visibility_scope && announcement.category === 'volunteer' && (
            <p className="text-app-sm text-text-secondary">
              {t('announcements.fields.visibilityScope')}: {announcement.visibility_scope}
            </p>
          )}

          {announcement.attachment_url && announcement.attachment_type === 'image' && (
            <img src={announcement.attachment_url} alt="" className="w-full rounded-card object-cover" />
          )}
          {announcement.attachment_url && announcement.attachment_type === 'pdf' && (
            <a
              href={announcement.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="text-app-base font-medium text-saffron underline"
            >
              {t('announcements.viewAttachment')}
            </a>
          )}
          {announcement.external_link && (
            <a
              href={announcement.external_link}
              target="_blank"
              rel="noreferrer"
              className="text-app-base font-medium text-saffron underline"
            >
              {announcement.external_link}
            </a>
          )}

          <div className="text-app-sm text-text-secondary">
            <p>
              {t('announcements.fields.publishAt')}: {new Date(announcement.publish_at).toLocaleString()}
            </p>
            {announcement.expiry_date && (
              <p>
                {t('announcements.fields.expiryDate')}: {new Date(announcement.expiry_date).toLocaleString()}
              </p>
            )}
            {announcement.created_by_name && (
              <p>
                {t('announcements.postedBy')}: {announcement.created_by_name}
              </p>
            )}
          </div>

          {(canEdit || canArchive || canRestore || canDelete) && editorSession && (
            <div className="mt-2 flex flex-wrap gap-3">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowEditDialog(true)}
                  disabled={isBusy}
                  className="rounded-card border border-black/10 px-4 py-2 text-app-base font-medium text-text-primary disabled:opacity-60 dark:border-white/10"
                >
                  {t('common.edit')}
                </button>
              )}
              {(announcement.is_archived ? canRestore : canArchive) && (
                <button
                  type="button"
                  onClick={() => void handleArchiveToggle()}
                  disabled={isBusy}
                  className="rounded-card border border-black/10 px-4 py-2 text-app-base font-medium text-text-primary disabled:opacity-60 dark:border-white/10"
                >
                  {announcement.is_archived ? t('announcements.restore') : t('announcements.archive')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isBusy}
                  className="rounded-card border border-danger/40 px-4 py-2 text-app-base font-medium text-danger disabled:opacity-60"
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showEditDialog && announcement && editorSession && (
        <CreateEditAnnouncementDialog
          sessionToken={editorSession.sessionToken}
          existing={announcement}
          onClose={() => setShowEditDialog(false)}
          onSaved={() => {
            setShowEditDialog(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
