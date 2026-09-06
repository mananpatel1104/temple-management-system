import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { GALLERY_CATEGORIES } from '../config/galleryCategories.config';
import { GalleryCategoryIcon } from '../components/GalleryCategoryIcon';
import { galleryService } from '../services/galleryService';
import type { GalleryAlbum, GallerySearchResult } from '../types/gallery.types';
import { ApiError } from '@shared/lib/functionsClient';

/**
 * Gallery Home Screen (SRS Chapter 11 — Gallery Module; SRS 11.3 Gallery
 * Home; SDD 8.1 MainLayout > RouteOutlet > GalleryScreen -> AlbumDetail
 * -> FullScreenViewer). Bottom Nav "Gallery" destination.
 *
 * Replaces the Task 7-era ComingSoon placeholder. Shows the four fixed
 * Gallery Home categories (11.3/FR-GAL-001) plus a search box
 * (FR-GAL-017). Viewing requires no PIN/session — every role including
 * Devotee can browse (11.17) — so this loads immediately for any
 * registered devotee.
 */
export function GalleryScreen() {
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const navigate = useNavigate();

  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GallerySearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    galleryService
      .listAlbums()
      .then((result) => {
        if (!cancelled) setAlbums(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dailyDarshanAlbum = albums.find((a) => a.album_type === 'daily_darshan');
  const countByType = (type: string) => albums.filter((a) => a.album_type === type).length;

  const openCategory = (categoryId: string) => {
    if (categoryId === 'daily_darshan') {
      if (dailyDarshanAlbum) navigate(`/gallery/album/${dailyDarshanAlbum.album_id}`);
      return;
    }
    navigate(`/gallery/${categoryId}`);
  };

  const runSearch = async (query: string) => {
    setSearchTerm(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const result = await galleryService.search(query.trim());
      setSearchResults(result);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('gallery.errors.generic'));
    } finally {
      setIsSearching(false);
    }
  };

  const isSearchActive = searchTerm.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-app-xl font-bold text-text-primary">{t('nav.gallery')}</h1>
        <p className="mt-1 text-app-base text-text-secondary">{t('gallery.subtitle')}</p>
      </header>

      {isOffline && (
        <p
          role="status"
          className="rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10"
        >
          {t('common.offline')} — {t('gallery.offlineNewContentUnavailable')}
        </p>
      )}

      <label htmlFor="gallery-search" className="sr-only">
        {t('gallery.searchPlaceholder')}
      </label>
      <input
        id="gallery-search"
        type="search"
        value={searchTerm}
        onChange={(event) => void runSearch(event.target.value)}
        placeholder={t('gallery.searchPlaceholder')}
        className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
      />

      {isSearchActive ? (
        <section aria-label={t('gallery.searchResultsTitle')} className="flex flex-col gap-3">
          <h2 className="text-app-lg font-semibold text-text-primary">{t('gallery.searchResultsTitle')}</h2>
          {isSearching ? (
            <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
          ) : searchResults && (searchResults.albums.length > 0 || searchResults.photos.length > 0) ? (
            <div className="flex flex-col gap-3">
              {searchResults.albums.map((album) => (
                <button
                  key={album.album_id}
                  type="button"
                  onClick={() => navigate(`/gallery/album/${album.album_id}`)}
                  className="flex items-center gap-3 rounded-card border border-black/10 bg-surface-light p-3 text-left dark:border-white/10 dark:bg-surface-dark"
                >
                  <AlbumThumb url={album.cover_image_url} />
                  <span className="min-w-0 flex-1 truncate text-app-base font-medium text-text-primary">
                    {album.album_name}
                  </span>
                </button>
              ))}
              {searchResults.photos.map((photo) => (
                <button
                  key={photo.photo_id}
                  type="button"
                  onClick={() => navigate(`/gallery/album/${photo.album_id}`)}
                  className="flex items-center gap-3 rounded-card border border-black/10 bg-surface-light p-3 text-left dark:border-white/10 dark:bg-surface-dark"
                >
                  <AlbumThumb url={photo.photo_url} />
                  <span className="min-w-0 flex-1 truncate text-app-base text-text-primary">
                    {photo.caption || photo.album_name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-app-base text-text-secondary">{t('gallery.noSearchResults')}</p>
          )}
        </section>
      ) : (
        <section aria-label={t('nav.gallery')} className="flex flex-col gap-3">
          {isLoading ? (
            <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
          ) : loadError ? (
            <p role="alert" className="text-app-base text-danger">
              {loadError}
            </p>
          ) : (
            GALLERY_CATEGORIES.map((category) => {
              const count =
                category.id === 'daily_darshan'
                  ? dailyDarshanAlbum
                    ? 1
                    : 0
                  : countByType(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => openCategory(category.id)}
                  className="flex w-full items-center gap-4 rounded-card border border-black/10 bg-surface-light p-4 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-surface-dark"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-devotional)] text-white">
                    <GalleryCategoryIcon name={category.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="truncate text-app-lg font-semibold text-text-primary">
                      {t(category.titleKey)}
                    </span>
                    <span className="mt-0.5 block text-app-base text-text-secondary">
                      {t(category.descriptionKey)}
                    </span>
                    {category.id !== 'daily_darshan' && (
                      <span className="mt-0.5 block text-app-sm text-text-secondary">
                        {count} {t('gallery.photoCountSuffix') /* album count, reusing the shared count suffix label */}
                      </span>
                    )}
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-text-secondary"
                    aria-hidden="true"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}

function AlbumThumb({ url }: { url: string | null }) {
  if (!url) {
    return <span className="h-12 w-12 shrink-0 rounded-card bg-black/5 dark:bg-white/10" aria-hidden="true" />;
  }
  return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-card object-cover" />;
}
