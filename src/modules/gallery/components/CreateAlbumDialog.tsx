import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { galleryService } from '../services/galleryService';
import { ApiError } from '@shared/lib/functionsClient';
import type { CreatableAlbumType } from '../types/gallery.types';

interface CreateAlbumDialogProps {
  albumType: CreatableAlbumType;
  sessionToken: string;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Create Album dialog (FR-GAL-015 — Supreme Administrator only, enforced
 * both by the caller only rendering this for permitted users and,
 * authoritatively, by the gallery Edge Function's requirePermission()
 * check). Matches PinDialog's fixed-overlay modal styling.
 */
export function CreateAlbumDialog({ albumType, sessionToken, onClose, onCreated }: CreateAlbumDialogProps) {
  const { t } = useLanguage();
  const [albumName, setAlbumName] = useState('');
  const [albumDate, setAlbumDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!albumName.trim()) {
      setErrorMessage(t('gallery.errors.albumNameRequired'));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await galleryService.createAlbum(sessionToken, {
        albumName: albumName.trim(),
        albumType,
        albumDate: albumDate || undefined,
      });
      onCreated();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.createAlbum')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card bg-surface-light p-6 shadow-[var(--shadow-card-elevated)] dark:bg-surface-dark"
      >
        <h2 className="mb-4 text-center text-app-lg font-semibold text-text-primary">{t('gallery.createAlbum')}</h2>

        <label htmlFor="album-name-input" className="mb-1 block text-app-sm text-text-secondary">
          {t('gallery.albumNameLabel')}
        </label>
        <input
          id="album-name-input"
          type="text"
          autoFocus
          value={albumName}
          onChange={(event) => setAlbumName(event.target.value)}
          className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
        />

        <label htmlFor="album-date-input" className="mb-1 block text-app-sm text-text-secondary">
          {t('gallery.albumDateLabel')}
        </label>
        <input
          id="album-date-input"
          type="date"
          value={albumDate}
          onChange={(event) => setAlbumDate(event.target.value)}
          className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
        />

        {errorMessage && (
          <p role="alert" className="mb-3 text-center text-app-sm text-danger">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
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
  );
}
