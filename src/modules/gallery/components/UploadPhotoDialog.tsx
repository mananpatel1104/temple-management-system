import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { galleryService } from '../services/galleryService';
import { ApiError } from '@shared/lib/functionsClient';
import { isSupportedGalleryMimeType, isWithinGalleryFileSizeLimit } from '../utils/imageOptimizer';

interface UploadPhotoDialogProps {
  albumId: string;
  sessionToken: string;
  onClose: () => void;
  onUploaded: () => void;
}

/**
 * Upload Photo dialog (FR-GAL-009/010/011/016 — Shreeji Yuvak Mandal
 * Head / Supreme Administrator, enforced authoritatively by the gallery
 * Edge Function). File selection, a client-side pre-check of type/size
 * (SEC-021/022 — the server re-validates authoritatively), an optional
 * caption (FR-GAL-013, never auto-translated), and a phase-based
 * progress indicator (see galleryService.uploadPhoto for why this is
 * phase-based rather than continuous byte progress).
 */
export function UploadPhotoDialog({ albumId, sessionToken, onClose, onUploaded }: UploadPhotoDialogProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'optimizing' | 'preparing' | 'uploading' | 'saving' | 'done'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = phase === 'optimizing' || phase === 'preparing' || phase === 'uploading' || phase === 'saving';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setValidationError(null);
    setErrorMessage(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!isSupportedGalleryMimeType(selected.type)) {
      setValidationError(t('gallery.errors.unsupportedFileType'));
      setFile(null);
      return;
    }
    if (!isWithinGalleryFileSizeLimit(selected.size)) {
      setValidationError(t('gallery.errors.fileTooLarge'));
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setErrorMessage(null);
    try {
      await galleryService.uploadPhoto(sessionToken, { albumId, file, caption: caption || undefined }, setPhase);
      onUploaded();
    } catch (error) {
      setPhase('idle');
      setErrorMessage(error instanceof ApiError ? error.message : t('gallery.uploadFailed'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.uploadPhoto')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card bg-surface-light p-6 shadow-[var(--shadow-card-elevated)] dark:bg-surface-dark"
      >
        <h2 className="mb-4 text-center text-app-lg font-semibold text-text-primary">{t('gallery.uploadPhoto')}</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="sr-only"
          id="gallery-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-3 w-full rounded-card border border-dashed border-black/20 px-4 py-6 text-center text-app-base text-text-secondary dark:border-white/20"
        >
          {file ? file.name : t('gallery.chooseFile')}
        </button>

        {validationError && (
          <p role="alert" className="mb-3 text-center text-app-sm text-danger">
            {validationError}
          </p>
        )}

        <label htmlFor="gallery-caption-input" className="mb-1 block text-app-sm text-text-secondary">
          {t('gallery.captionLabel')}
        </label>
        <input
          id="gallery-caption-input"
          type="text"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t('gallery.captionPlaceholder')}
          maxLength={300}
          className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
        />

        {isBusy && (
          <p role="status" className="mb-3 text-center text-app-sm text-text-secondary">
            {phase === 'optimizing' ? t('gallery.optimizingImage') : t('gallery.uploading')}
          </p>
        )}

        {errorMessage && (
          <div className="mb-3 text-center">
            <p role="alert" className="text-app-sm text-danger">
              {errorMessage}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex-1 rounded-card border border-black/10 px-4 py-3 text-app-base text-text-secondary disabled:opacity-60 dark:border-white/10"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!file || isBusy}
            className="flex-1 rounded-card bg-saffron px-4 py-3 text-app-base font-semibold text-white disabled:opacity-60"
          >
            {isBusy ? (phase === 'optimizing' ? t('gallery.optimizingImage') : t('gallery.uploading')) : errorMessage ? t('gallery.retryUpload') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
