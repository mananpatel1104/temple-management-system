import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { ApiError } from '@shared/lib/functionsClient';
import { announcementService } from '../services/announcementService';
import { ANNOUNCEMENT_CATEGORIES } from '../config/announcementCategories.config';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { CreateEditAnnouncementDialog } from '../components/CreateEditAnnouncementDialog';
import type { Announcement, AnnouncementCategory } from '../types/announcement.types';

/**
 * Announcements module home (`/announcements`, SRS Chapter 12 — replaces
 * the Task-10A "Coming Soon" placeholder). List + category filter +
 * search + Active/Archive toggle (12.11/12.12/12.16); Create entry point
 * shown only if the signed-in role can create at least one category
 * (BR-014), same `hasPermission` RBAC gate used everywhere else.
 *
 * Every list/search request goes through announcementService, which
 * forwards the current editor session token (if any) so
 * VisibilityResolver on the server can widen the result set — but never
 * requires one, since Devotees browse this screen without ever
 * authenticating (SRS Chapter 6 / 12.15 "View Announcements" (checked) for
 * every role).
 */
export function AnnouncementsScreen() {
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { hasPermission, editorSession } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<'active' | 'archived'>('active');
  const [categoryFilter, setCategoryFilter] = useState<AnnouncementCategory | 'all'>('all');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Announcement[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const canCreateAny = ANNOUNCEMENT_CATEGORIES.some((c) => hasPermission('announcements', c.createAction));

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await announcementService.list(
        { view, category: categoryFilter === 'all' ? undefined : categoryFilter },
        editorSession?.sessionToken,
      );
      setAnnouncements(result.announcements);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('announcements.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, categoryFilter, editorSession?.sessionToken]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const result = await announcementService.search(trimmed, editorSession?.sessionToken);
        setSearchResults(result.announcements);
      } catch (error) {
        setLoadError(error instanceof ApiError ? error.message : t('announcements.errors.generic'));
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, editorSession?.sessionToken]);

  const displayedAnnouncements = searchResults ?? announcements;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-app-xl font-bold text-text-primary">{t('nav.announcements')}</h1>
        {canCreateAny && (
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            disabled={isOffline}
            className="shrink-0 rounded-card bg-saffron px-4 py-2 text-app-base font-semibold text-white disabled:opacity-60"
          >
            {t('announcements.createAnnouncement')}
          </button>
        )}
      </div>

      {isOffline && (
        <p role="status" className="mb-4 rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
          {t('common.offline')} — {t('announcements.offlineNotice')}
        </p>
      )}

      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t('announcements.searchPlaceholder')}
        aria-label={t('announcements.searchPlaceholder')}
        className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-app-base text-text-primary dark:border-white/10"
      />

      {!searchResults && (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-app-sm font-medium ${
                categoryFilter === 'all' ? 'bg-saffron text-white' : 'border border-black/10 text-text-secondary dark:border-white/10'
              }`}
            >
              {t('announcements.categories.all')}
            </button>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-app-sm font-medium ${
                  categoryFilter === c.id ? 'bg-saffron text-white' : 'border border-black/10 text-text-secondary dark:border-white/10'
                }`}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setView('active')}
              className={`rounded-card px-4 py-2 text-app-sm font-medium ${
                view === 'active' ? 'bg-black/10 text-text-primary dark:bg-white/10' : 'text-text-secondary'
              }`}
            >
              {t('announcements.tabs.active')}
            </button>
            <button
              type="button"
              onClick={() => setView('archived')}
              className={`rounded-card px-4 py-2 text-app-sm font-medium ${
                view === 'archived' ? 'bg-black/10 text-text-primary dark:bg-white/10' : 'text-text-secondary'
              }`}
            >
              {t('announcements.tabs.archived')}
            </button>
          </div>
        </>
      )}

      {isLoading || isSearching ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : loadError ? (
        <p role="alert" className="text-app-base text-danger">
          {loadError}
        </p>
      ) : displayedAnnouncements.length === 0 ? (
        <p className="text-app-base text-text-secondary">
          {searchResults ? t('announcements.noSearchResults') : t('announcements.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.announcement_id}
              announcement={announcement}
              onSelect={() => navigate(`/announcements/${announcement.announcement_id}`)}
            />
          ))}
        </div>
      )}

      {showCreateDialog && editorSession && (
        <CreateEditAnnouncementDialog
          sessionToken={editorSession.sessionToken}
          onClose={() => setShowCreateDialog(false)}
          onSaved={() => {
            setShowCreateDialog(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
