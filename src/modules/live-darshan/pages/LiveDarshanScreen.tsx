import { useEffect, useState } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { ApiError } from '@shared/lib/functionsClient';
import { liveDarshanService } from '../services/liveDarshanService';
import { WatchLiveSection } from '../components/WatchLiveSection';
import { SaturdayKathaCard } from '../components/SaturdayKathaCard';
import { KathaArchiveList } from '../components/KathaArchiveList';
import { StreamConfigForm } from '../components/StreamConfigForm';
import { SaturdayScheduleEditForm } from '../components/SaturdayScheduleEditForm';
import { AddArchiveEntryForm } from '../components/AddArchiveEntryForm';
import type { KathaArchiveEntry, LiveStatusResult, SaturdayKathaSchedule } from '../types/liveDarshan.types';

/**
 * Live Darshan & Katha screen (`/live-darshan`, SRS Chapter 10; SDD 4.5).
 * Not a Bottom Navigation Bar tab (SRS 24.8 fixes that tab set) — reached
 * from the Home Dashboard's Live Darshan Card, matching how Notifications
 * (Task 10C) is reached from the TopBar bell icon instead of the tab bar.
 *
 * SRS 10.8: Live Darshan/Live Katha status and playback require the
 * internet. When offline, this screen shows the SRS-specified message
 * immediately and does not attempt (or serve a stale cached answer to)
 * a status call — see cacheStrategies.ts header note on why getStatus is
 * deliberately never cached. The Katha Archive *listing* (not playback)
 * and the Saturday Katha schedule may still show previously-cached data
 * while offline (SRS 10.8 only restricts "playback").
 */
export function LiveDarshanScreen() {
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { editorSession, hasPermission } = useAuth();
  const sessionToken = editorSession?.sessionToken;

  const canViewSchedule = hasPermission('live_darshan', 'view_saturday_schedule');
  const canConfigureStream = hasPermission('live_darshan', 'configure_stream');
  const canEditSchedule = hasPermission('live_darshan', 'edit_saturday_schedule');
  const canManageArchive = hasPermission('live_darshan', 'manage_archive');

  const [status, setStatus] = useState<LiveStatusResult | null>(null);
  const [schedule, setSchedule] = useState<SaturdayKathaSchedule | null>(null);
  const [archive, setArchive] = useState<KathaArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const tasks: Promise<void>[] = [];

      // FR-LIVE status: only ever fetched while online (SRS 10.8).
      if (!isOffline) {
        tasks.push(liveDarshanService.getStatus(sessionToken).then((result) => setStatus(result)));
      } else {
        setStatus(null);
      }

      tasks.push(liveDarshanService.listArchive().then((result) => setArchive(result.entries)));

      if (canViewSchedule && sessionToken) {
        tasks.push(liveDarshanService.getSaturdaySchedule(sessionToken).then((result) => setSchedule(result)));
      }

      await Promise.all(tasks);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : t('liveDarshan.errors.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, sessionToken, canViewSchedule]);

  const handleRemoveArchiveEntry = async (entry: KathaArchiveEntry) => {
    if (!sessionToken) return;
    if (!window.confirm(t('liveDarshan.archive.confirmRemove'))) return;
    setRemovingId(entry.archive_id);
    try {
      await liveDarshanService.removeArchiveEntry(sessionToken, entry.archive_id);
      setArchive((prev) => prev.filter((e) => e.archive_id !== entry.archive_id));
    } catch (error) {
      window.alert(error instanceof ApiError ? error.message : t('liveDarshan.errors.generic'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-app-xl font-bold text-text-primary">{t('liveDarshan.title')}</h1>

      {isOffline && (
        <p role="status" className="rounded-card bg-black/5 px-4 py-3 text-app-sm text-text-secondary dark:bg-white/10">
          {t('common.offline')} — {t('liveDarshan.errors.internetRequired')}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-app-base text-danger">
          {loadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-app-base text-text-secondary">{t('common.loading')}</p>
      ) : (
        <>
          {!isOffline && status ? (
            <>
              <WatchLiveSection variant="darshan" status={status.darshan} />
              <WatchLiveSection variant="katha" status={status.katha} />
            </>
          ) : isOffline ? null : (
            <p className="text-app-sm text-text-secondary">{t('liveDarshan.errors.generic')}</p>
          )}

          {canViewSchedule && <SaturdayKathaCard schedule={schedule} />}

          <section>
            <h2 className="mb-2 text-app-base font-semibold text-text-primary">{t('liveDarshan.archive.title')}</h2>
            <KathaArchiveList
              entries={archive}
              onRemove={canManageArchive && sessionToken ? handleRemoveArchiveEntry : undefined}
              removingId={removingId}
            />
          </section>

          {(canConfigureStream || canEditSchedule || canManageArchive) && sessionToken && (
            <section className="mt-4 flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/10">
              <h2 className="text-app-base font-semibold text-text-primary">{t('liveDarshan.admin.title')}</h2>

              {isOffline && (
                // FR-LIVE-013/014 configuration is itself a network write
                // (SRS "New live-stream access/configuration requires
                // Internet") — the forms below would only fail on submit
                // while offline, so this note is shown up front instead.
                <p className="text-app-sm text-text-secondary">{t('liveDarshan.errors.internetRequired')}</p>
              )}

              {canConfigureStream && status && (
                <>
                  <StreamConfigForm sessionToken={sessionToken} variant="darshan" status={status.darshan} onSaved={loadAll} />
                  <StreamConfigForm sessionToken={sessionToken} variant="katha" status={status.katha} onSaved={loadAll} />
                </>
              )}

              {canEditSchedule && (
                <SaturdayScheduleEditForm sessionToken={sessionToken} schedule={schedule} onSaved={setSchedule} />
              )}

              {canManageArchive && <AddArchiveEntryForm sessionToken={sessionToken} onCreated={loadAll} />}
            </section>
          )}
        </>
      )}
    </div>
  );
}
