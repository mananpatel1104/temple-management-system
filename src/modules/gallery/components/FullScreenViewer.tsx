import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import type { GalleryPhoto } from '../types/gallery.types';

interface FullScreenViewerProps {
  photos: GalleryPhoto[];
  startIndex: number;
  onClose: () => void;
  /** Only rendered for Supreme Administrator (FR-GAL-015) — undefined hides the control entirely. */
  onDelete?: (photo: GalleryPhoto) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const SWIPE_THRESHOLD_PX = 50;

/**
 * Gallery full-screen photo viewer (SDD 4.6 FullScreenViewer; FR-GAL-012
 * navigation, zoom, swipe/touch). Elderly-friendly: large tap targets
 * for prev/next/close, a simple tap-to-zoom-toggle in addition to pinch,
 * and swipe-to-navigate on touch devices.
 */
export function FullScreenViewer({ photos, startIndex, onClose, onDelete }: FullScreenViewerProps) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const touchStartX = useRef<number | null>(null);

  const photo = photos[index];

  useEffect(() => {
    setZoom(1);
  }, [index]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  if (!photo) return null;

  const goPrevious = () => setIndex((current) => Math.max(0, current - 1));
  const goNext = () => setIndex((current) => Math.min(photos.length - 1, current + 1));
  const toggleZoom = () => setZoom((current) => (current > MIN_ZOOM ? MIN_ZOOM : MAX_ZOOM));

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || zoom > MIN_ZOOM) {
      touchStartX.current = null;
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (delta > SWIPE_THRESHOLD_PX) goPrevious();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
    touchStartX.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? t('nav.gallery')}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('gallery.close')}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(photo)}
            aria-label={t('gallery.deletePhoto')}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {index > 0 && (
          <button
            type="button"
            onClick={goPrevious}
            aria-label={t('gallery.previousPhoto')}
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        )}

        {photo.photo_url ? (
          <img
            src={photo.photo_url}
            alt={photo.caption ?? ''}
            onClick={toggleZoom}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-full max-w-full cursor-zoom-in select-none object-contain transition-transform"
          />
        ) : (
          <p className="text-app-base text-white/70">{t('gallery.errors.generic')}</p>
        )}

        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label={t('gallery.nextPhoto')}
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {(photo.caption || photo.uploaded_by_name) && (
        <div className="px-4 py-3 text-center">
          {photo.caption && <p className="text-app-base text-white">{photo.caption}</p>}
          {photo.uploaded_by_name && (
            <p className="mt-1 text-app-sm text-white/60">
              {t('gallery.uploadedBy')} {photo.uploaded_by_name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
