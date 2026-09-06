import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { ApiError } from '@shared/lib/functionsClient';
import { announcementService } from '../services/announcementService';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_PRIORITY_LABEL_KEYS } from '../config/announcementCategories.config';
import type { Announcement, AnnouncementCategory, AnnouncementPriority } from '../types/announcement.types';
import {
  ANNOUNCEMENT_ATTACHMENT_MIME_TYPES,
  ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_BYTES,
} from '../config/announcementAttachment.config';

interface CreateEditAnnouncementDialogProps {
  sessionToken: string;
  /** Present when editing an existing announcement; absent when creating a new one. */
  existing?: Announcement;
  onClose: () => void;
  onSaved: (announcement: Announcement) => void;
}

function toLocalDateTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create/Edit form (SRS 12.4/12.5/12.7/12.8/12.9). Category (12.4) can
 * only be chosen at creation time — see the Edge Function's handleUpdate
 * comment for why it is not editable afterwards — and the list of
 * choices is filtered to whichever categories the current role is
 * permitted to create (BR-014), using the SAME `hasPermission` RBAC
 * check as every other privileged control in this app (Task 10B §6:
 * "Every privileged action must use the existing can() mechanism").
 */
export function CreateEditAnnouncementDialog({
  sessionToken,
  existing,
  onClose,
  onSaved,
}: CreateEditAnnouncementDialogProps) {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();

  const creatableCategories = ANNOUNCEMENT_CATEGORIES.filter((c) => hasPermission('announcements', c.createAction));

  const [category, setCategory] = useState<AnnouncementCategory>(existing?.category ?? creatableCategories[0]?.id ?? 'general');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState<AnnouncementPriority>(existing?.priority ?? 'medium');
  const [visibilityScope, setVisibilityScope] = useState(existing?.visibility_scope ?? '');
  const [publishAt, setPublishAt] = useState(existing ? toLocalDateTimeInputValue(existing.publish_at) : '');
  const [expiryDate, setExpiryDate] = useState(existing ? toLocalDateTimeInputValue(existing.expiry_date) : '');
  const [externalLink, setExternalLink] = useState(existing?.external_link ?? '');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAttachmentFile(null);
      return;
    }
    if (!(ANNOUNCEMENT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setErrorMessage(t('announcements.errors.attachmentType'));
      event.target.value = '';
      return;
    }
    if (file.size > ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_BYTES) {
      setErrorMessage(t('announcements.errors.attachmentSize'));
      event.target.value = '';
      return;
    }
    setErrorMessage(null);
    setAttachmentFile(file);
    setExternalLink(''); // Attachment and External Link are mutually exclusive (SRS 12.9).
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      setErrorMessage(t('announcements.errors.titleRequired'));
      return;
    }
    if (!trimmedDescription) {
      setErrorMessage(t('announcements.errors.descriptionRequired'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let saved: Announcement;
      const commonFields = {
        title: trimmedTitle,
        description: trimmedDescription,
        priority,
        visibilityScope: visibilityScope.trim() || undefined,
        publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        externalLink: attachmentFile ? undefined : externalLink.trim() || undefined,
      };

      if (existing) {
        saved = await announcementService.update(sessionToken, { id: existing.announcement_id, ...commonFields });
      } else {
        saved = await announcementService.create(sessionToken, { category, ...commonFields });
      }

      if (attachmentFile) {
        const attachmentType = attachmentFile.type === 'application/pdf' ? 'pdf' : 'image';
        saved = await announcementService.uploadAttachment(sessionToken, {
          id: saved.announcement_id,
          file: attachmentFile,
          attachmentType,
        });
      }

      onSaved(saved);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('announcements.errors.generic'));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? t('announcements.editAnnouncement') : t('announcements.createAnnouncement')}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8"
    >
      <div className="w-full max-w-md rounded-card bg-surface-light p-6 shadow-[var(--shadow-card-elevated)] dark:bg-surface-dark">
        <h2 className="mb-4 text-center text-app-lg font-semibold text-text-primary">
          {existing ? t('announcements.editAnnouncement') : t('announcements.createAnnouncement')}
        </h2>

        {errorMessage && (
          <p role="alert" className="mb-3 text-center text-app-sm text-danger">
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!existing && (
            <div>
              <label htmlFor="announcement-category" className="mb-1 block text-app-sm text-text-secondary">
                {t('announcements.fields.category')}
              </label>
              <select
                id="announcement-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as AnnouncementCategory)}
                className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
              >
                {creatableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="announcement-title" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.title')}
            </label>
            <input
              id="announcement-title"
              type="text"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            />
          </div>

          <div>
            <label htmlFor="announcement-description" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.description')}
            </label>
            <textarea
              id="announcement-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            />
          </div>

          <div>
            <label htmlFor="announcement-priority" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.priority')}
            </label>
            <select
              id="announcement-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as AnnouncementPriority)}
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            >
              {(['high', 'medium', 'low'] as AnnouncementPriority[]).map((p) => (
                <option key={p} value={p}>
                  {t(ANNOUNCEMENT_PRIORITY_LABEL_KEYS[p])}
                </option>
              ))}
            </select>
          </div>

          {category === 'volunteer' && (
            <div>
              <label htmlFor="announcement-scope" className="mb-1 block text-app-sm text-text-secondary">
                {t('announcements.fields.visibilityScope')}
              </label>
              <input
                id="announcement-scope"
                type="text"
                value={visibilityScope}
                onChange={(event) => setVisibilityScope(event.target.value)}
                placeholder={t('announcements.fields.visibilityScopePlaceholder')}
                className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
              />
            </div>
          )}

          <div>
            <label htmlFor="announcement-publish-at" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.publishAt')}
            </label>
            <input
              id="announcement-publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            />
            <p className="mt-1 text-app-sm text-text-secondary">{t('announcements.fields.publishAtHint')}</p>
          </div>

          <div>
            <label htmlFor="announcement-expiry" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.expiryDate')}
            </label>
            <input
              id="announcement-expiry"
              type="datetime-local"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            />
          </div>

          <div>
            <label htmlFor="announcement-link" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.externalLink')}
            </label>
            <input
              id="announcement-link"
              type="url"
              value={externalLink}
              disabled={Boolean(attachmentFile)}
              onChange={(event) => setExternalLink(event.target.value)}
              placeholder="https://"
              className="w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary disabled:opacity-60 dark:border-white/10"
            />
          </div>

          <div>
            <label htmlFor="announcement-attachment" className="mb-1 block text-app-sm text-text-secondary">
              {t('announcements.fields.attachment')}
            </label>
            <input
              id="announcement-attachment"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="w-full text-app-sm text-text-secondary"
            />
            <p className="mt-1 text-app-sm text-text-secondary">{t('announcements.fields.attachmentHint')}</p>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-card border border-black/10 px-4 py-3 text-app-base text-text-secondary dark:border-white/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-card bg-saffron px-4 py-3 text-app-base font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
