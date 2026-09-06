import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { galleryService } from '../services/galleryService';
import { UploadPhotoDialog } from '../components/UploadPhotoDialog';
import { FullScreenViewer } from '../components/FullScreenViewer';
import { ManageAlbumDialog } from '../components/ManageAlbumDialog';
import type { GalleryAlbum, GalleryPhoto } from '../types/gallery.types';
import { ApiError } from '@shared/lib/functionsClient';

/**
 * Album detail screen (`/gallery/album/:albumId`) — FR-GAL-003/010/012:
 * photo grid (newest first), Upload Photo entry point (if permitted),
 * and the full-screen viewer opened by tapping any thumbnail.
 */
export function GalleryAlbumDetailScreen() {
  const { albumId } = useParams<{ albumId: string }>();
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { hasPermission, editorSession } = useAuth();
  const navigate = useNavigate();

  const [album, setAlbum] = useState<GalleryAlbum | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const canUpload = hasPermission('gallery', 'upload');
  const canDeletePhoto = hasPermission('gallery', 'delete_photo');
  const canRenameAlbum = hasPermission('gallery', 'rename_album');
  const canArchiveAlbum = hasPermission('gallery', 'archive_album');
  const canDeleteAlbum = hasPermission('gallery', 'delete_album');
  const canManageAlbum = canRenameAlbum || canArchiveAlbum || canDeleteAlbum;

  const load = async () => {
    if (!albumId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [albumDetail, photoPage] = await Promise.all([
        galleryService.getAlbum(albumId),
        galleryService.listPhotos(albumId),
      ]);
      setAlbum(albumDetail);
      setPhotos(photoPage.photos);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  const handleDeletePhoto = async (photo: GalleryPhoto) => {
    if (!editorSession) return;
    if (!window.confirm(t('gallery.confirmDeletePhoto'))) return;
    try {
      await galleryService.deletePhoto(editorSession.sessionToken, photo.photo_id);
      setViewerIndex(null);
      void load();
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
    }
  };

  const backHref =
    album && album.album_type !== 'daily_darshan' ? `/gallery/${album.album_type}` : '/gallery';
  const backLabel = album && album.album_type !== 'daily_darshan' ? t('gallery.backToAlbums') : t('gallery.backToGallery');

  return (
    <div className="flex flex-1 flex-col">
      <Link to={backHref} className="mb-4 inline-flex w-fit items-center gap-1 text-app-base font-medium text-saffron">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {backLabel}
      </Link>

      {isLoading ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : loadError ? (
        <p role="alert" className="text-app-base text-danger">
          {loadError}
        </p>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="min-w-0 flex-1 truncate text-app-xl font-bold text-text-primary">
              {album?.album_name}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {canManageAlbum && album && (
                <button
                  type="button"
                  onClick={() => setShowManageDialog(true)}
                  disabled={isOffline}
                  className="rounded-card border border-black/10 px-4 py-2 text-app-base font-semibold text-text-primary disabled:opacity-60 dark:border-white/10"
                >
                  {t('gallery.manageAlbum')}
                </button>
              )}
              {canUpload && (
                <button
                  type="button"
                  onClick={() => setShowUploadDialog(true)}
                  disabled={isOffline}
                  className="rounded-card bg-saffron px-4 py-2 text-app-base font-semibold text-white disabled:opacity-60"
                >
                  {t('gallery.uploadPhoto')}
                </button>
              )}
            </div>
          </div>

          {album?.is_archived && (
            <p role="status" className="mb-4 rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
              {t('gallery.albumArchivedNotice')}
            </p>
          )}

          {isOffline && (
            <p role="status" className="mb-4 rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
              {t('common.offline')} — {t('gallery.offlineUploadUnavailable')}
            </p>
          )}

          {photos.length === 0 ? (
            <p className="text-app-base text-text-secondary">{t('gallery.noPhotos')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <button
                  key={photo.photo_id}
                  type="button"
                  onClick={() => setViewerIndex(i)}
                  className="aspect-square overflow-hidden rounded-card bg-black/5 dark:bg-white/10"
                >
                  {photo.photo_url && (
                    <img src={photo.photo_url} alt={photo.caption ?? ''} className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showUploadDialog && albumId && editorSession && (
        <UploadPhotoDialog
          albumId={albumId}
          sessionToken={editorSession.sessionToken}
          onClose={() => setShowUploadDialog(false)}
          onUploaded={() => {
            setShowUploadDialog(false);
            void load();
          }}
        />
      )}

      {showManageDialog && album && editorSession && (
        <ManageAlbumDialog
          album={album}
          sessionToken={editorSession.sessionToken}
          canRename={canRenameAlbum}
          canArchive={canArchiveAlbum}
          canDelete={canDeleteAlbum}
          onClose={() => setShowManageDialog(false)}
          onRenamed={(newName) => {
            setAlbum((current) => (current ? { ...current, album_name: newName } : current));
            setShowManageDialog(false);
          }}
          onArchiveToggled={(archived) => {
            setAlbum((current) => (current ? { ...current, is_archived: archived } : current));
            setShowManageDialog(false);
          }}
          onDeleted={() => {
            setShowManageDialog(false);
            navigate(backHref, { replace: true });
          }}
        />
      )}

      {viewerIndex !== null && (
        <FullScreenViewer
          photos={photos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={canDeletePhoto ? handleDeletePhoto : undefined}
        />
      )}
    </div>
  );
}
