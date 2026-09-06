import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import type { KathaArchiveEntry } from '../types/liveDarshan.types';

interface KathaArchiveListProps {
  entries: KathaArchiveEntry[];
  /** Present only for a role permitted 'manage_archive' (Supreme Administrator, 10.9 "Remove Archive"). */
  onRemove?: (entry: KathaArchiveEntry) => void;
  removingId?: string | null;
}

/**
 * FR-LIVE-010/011 — Katha Archive, reverse-chronological (already
 * ordered server-side by the Edge Function's `listArchive` action).
 * Playback (Watch button) requires the internet per SRS 10.8; the list
 * itself may be shown from cache while offline (see
 * liveDarshanService.listArchive / cacheStrategies.ts), so the Watch
 * button is disabled with an inline note instead of hiding the whole
 * list offline.
 */
export function KathaArchiveList({ entries, onRemove, removingId }: KathaArchiveListProps) {
  const { t } = useLanguage();
  const { isOffline } = useOffline();

  if (entries.length === 0) {
    return <p className="text-app-sm text-text-secondary">{t('liveDarshan.archive.empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li
          key={entry.archive_id}
          className="flex items-center gap-3 rounded-card border border-black/10 p-3 dark:border-white/10"
        >
          {entry.thumbnail_url ? (
            <img
              src={entry.thumbnail_url}
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-card object-cover"
            />
          ) : (
            <div className="h-14 w-14 flex-shrink-0 rounded-card bg-black/5 dark:bg-white/10" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-app-sm font-semibold text-text-primary">{entry.title}</p>
            <p className="text-app-sm text-text-secondary">
              {new Date(entry.katha_date).toLocaleDateString()}
              {entry.speaker_name ? ` · ${entry.speaker_name}` : ''}
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <a
              href={isOffline ? undefined : entry.watch_url}
              target="_blank"
              rel="noreferrer"
              aria-disabled={isOffline}
              onClick={(event) => {
                if (isOffline) event.preventDefault();
              }}
              className={`rounded-card px-3 py-1.5 text-app-sm font-semibold ${
                isOffline
                  ? 'cursor-not-allowed bg-black/5 text-text-secondary dark:bg-white/10'
                  : 'bg-saffron text-white'
              }`}
            >
              {t('liveDarshan.archive.watch')}
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(entry)}
                disabled={removingId === entry.archive_id}
                className="text-app-sm font-medium text-danger disabled:opacity-50"
              >
                {removingId === entry.archive_id ? t('common.loading') : t('liveDarshan.archive.remove')}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
