import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { GALLERY_CATEGORIES } from '../config/galleryCategories.config';
import { galleryService } from '../services/galleryService';
import { CreateAlbumDialog } from '../components/CreateAlbumDialog';
import type { AlbumType, CreatableAlbumType, GalleryAlbum } from '../types/gallery.types';
import { ApiError } from '@shared/lib/functionsClient';

const CREATABLE_TYPES: AlbumType[] = ['festival', 'sabha', 'event'];

/**
 * Gallery album-listing route (`/gallery/:albumType`) for the
 * user-created album categories — Festival, Sabha, Event (FR-GAL-004/
 * 007/008). The Daily Darshan category is a singleton and never reaches
 * this screen (GalleryScreen navigates straight to its album detail).
 */
export function GalleryAlbumListScreen() {
  const { albumType } = useParams<{ albumType: string }>();
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { hasPermission, editorSession } = useAuth();
  const navigate = useNavigate();

  const category = GALLERY_CATEGORIES.find((c) => c.id === albumType);

  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canCreate = hasPermission('gallery', 'create_album');

  const load = async () => {
    if (!albumType) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await galleryService.listAlbums(albumType as AlbumType);
      setAlbums(result);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumType]);

  if (!albumType || !category || !CREATABLE_TYPES.includes(albumType as AlbumType)) {
    return <Navigate to="/gallery" replace />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Link to="/gallery" className="mb-4 inline-flex w-fit items-center gap-1 text-app-base font-medium text-saffron">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 6-6 6 6 6" />
        </svg>
        {t('gallery.backToGallery')}
      </Link>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-app-xl font-bold text-text-primary">{t(category.titleKey)}</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            disabled={isOffline}
            className="shrink-0 rounded-card bg-saffron px-4 py-2 text-app-base font-semibold text-white disabled:opacity-60"
          >
            {t('gallery.createAlbum')}
          </button>
        )}
      </div>

      {isOffline && (
        <p role="status" className="mb-4 rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
          {t('common.offline')} — {t('gallery.offlineNewContentUnavailable')}
        </p>
      )}

      {isLoading ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : loadError ? (
        <p role="alert" className="text-app-base text-danger">
          {loadError}
        </p>
      ) : albums.length === 0 ? (
        <p className="text-app-base text-text-secondary">{t('gallery.noAlbums')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {albums.map((album) => (
            <button
              key={album.album_id}
              type="button"
              onClick={() => navigate(`/gallery/album/${album.album_id}`)}
              className="flex items-center gap-4 rounded-card border border-black/10 bg-surface-light p-3 text-left shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-surface-dark"
            >
              {album.cover_image_url ? (
                <img
                  src={album.cover_image_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-card object-cover"
                />
              ) : (
                <span className="h-16 w-16 shrink-0 rounded-card bg-black/5 dark:bg-white/10" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-app-lg font-semibold text-text-primary">
                  {album.album_name}
                </span>
                <span className="mt-0.5 block text-app-sm text-text-secondary">
                  {album.album_date ? `${album.album_date} · ` : ''}
                  {album.photo_count} {t('gallery.photoCountSuffix')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreateDialog && editorSession && (
        <CreateAlbumDialog
          albumType={albumType as CreatableAlbumType}
          sessionToken={editorSession.sessionToken}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
