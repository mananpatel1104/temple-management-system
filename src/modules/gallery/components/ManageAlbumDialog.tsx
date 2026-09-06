import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { galleryService } from '../services/galleryService';
import { ApiError } from '@shared/lib/functionsClient';
import type { GalleryAlbum } from '../types/gallery.types';

interface ManageAlbumDialogProps {
  album: GalleryAlbum;
  sessionToken: string;
  /** Each flag mirrors a distinct RBAC permission (gallery.rename_album / .archive_album / .delete_album) — the caller computes these via useAuth().hasPermission, the same existing RBAC system used everywhere else, so this dialog never makes its own authorization decisions. */
  canRename: boolean;
  canArchive: boolean;
  canDelete: boolean;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onArchiveToggled: (archived: boolean) => void;
  onDeleted: () => void;
}

/**
 * Album-management action sheet (FR-GAL-015 — Supreme Administrator
 * only). The Edge Function's requirePermission() check is the
 * authoritative gate for every action here; the `can*` props only
 * control what this already-permission-gated dialog renders. Matches
 * CreateAlbumDialog's fixed-overlay modal styling.
 */
export function ManageAlbumDialog({
  album,
  sessionToken,
  canRename,
  canArchive,
  canDelete,
  onClose,
  onRenamed,
  onArchiveToggled,
  onDeleted,
}: ManageAlbumDialogProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'menu' | 'rename'>('menu');
  const [albumName, setAlbumName] = useState(album.album_name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Daily Darshan is a seeded singleton the Edge Function always refuses
  // to delete (see handleDeleteAlbum) — hide the control rather than let
  // the Supreme Administrator hit a guaranteed server error.
  const canDeleteThisAlbum = canDelete && album.album_type !== 'daily_darshan';

  const handleRenameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = albumName.trim();
    if (!trimmed) {
      setErrorMessage(t('gallery.errors.albumNameRequired'));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await galleryService.renameAlbum(sessionToken, album.album_id, trimmed);
      onRenamed(trimmed);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async () => {
    const nextArchived = !album.is_archived;
    const confirmMessage = nextArchived ? t('gallery.confirmArchiveAlbum') : t('gallery.confirmUnarchiveAlbum');
    if (!window.confirm(confirmMessage)) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await galleryService.archiveAlbum(sessionToken, album.album_id, nextArchived);
      onArchiveToggled(nextArchived);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('gallery.confirmDeleteAlbum'))) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await galleryService.deleteAlbum(sessionToken, album.album_id);
      onDeleted();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.manageAlbum')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-sm rounded-card bg-surface-light p-6 shadow-[var(--shadow-card-elevated)] dark:bg-surface-dark">
        <h2 className="mb-4 text-center text-app-lg font-semibold text-text-primary">{t('gallery.manageAlbum')}</h2>

        {errorMessage && (
          <p role="alert" className="mb-3 text-center text-app-sm text-danger">
            {errorMessage}
          </p>
        )}

        {mode === 'menu' ? (
          <div className="flex flex-col gap-3">
            {canRename && (
              <button
                type="button"
                onClick={() => setMode('rename')}
                disabled={isSubmitting}
                className="w-full rounded-card border border-black/10 px-4 py-3 text-app-base font-medium text-text-primary disabled:opacity-60 dark:border-white/10"
              >
                {t('gallery.renameAlbum')}
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={() => void handleArchiveToggle()}
                disabled={isSubmitting}
                className="w-full rounded-card border border-black/10 px-4 py-3 text-app-base font-medium text-text-primary disabled:opacity-60 dark:border-white/10"
              >
                {isSubmitting ? t('common.loading') : album.is_archived ? t('gallery.unarchiveAlbum') : t('gallery.archiveAlbum')}
              </button>
            )}
            {canDeleteThisAlbum && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isSubmitting}
                className="w-full rounded-card border border-danger/40 px-4 py-3 text-app-base font-medium text-danger disabled:opacity-60"
              >
                {isSubmitting ? t('common.loading') : t('gallery.deleteAlbum')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full rounded-card px-4 py-3 text-app-base text-text-secondary"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleRenameSubmit}>
            <label htmlFor="rename-album-input" className="mb-1 block text-app-sm text-text-secondary">
              {t('gallery.albumNameLabel')}
            </label>
            <input
              id="rename-album-input"
              type="text"
              autoFocus
              value={albumName}
              onChange={(event) => setAlbumName(event.target.value)}
              className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('menu')}
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
        )}
      </div>
    </div>
  );
}
