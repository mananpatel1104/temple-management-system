import { useLanguage } from '@app/providers/LanguageProvider';
import type { LiveDarshanStatusResult, LiveKathaStatusResult } from '../types/liveDarshan.types';
import { LiveStatusBadge } from './LiveStatusBadge';

interface WatchLiveSectionProps {
  variant: 'darshan' | 'katha';
  status: LiveDarshanStatusResult | LiveKathaStatusResult;
}

function isKathaStatus(
  variant: 'darshan' | 'katha',
  _status: LiveDarshanStatusResult | LiveKathaStatusResult,
): _status is LiveKathaStatusResult {
  return variant === 'katha';
}

/**
 * FR-LIVE-001/002/003 (Live Darshan) and FR-LIVE-005/006/007 (Live
 * Katha) — a dedicated section with Live Status, (for Katha: Title/
 * Speaker/Date/Time), and a large Watch Live button (SRS 10.10). On
 * error opening the stream (a popup blocker, etc.), FR-LIVE error
 * handling ("Unable to open Live Stream...") is shown inline rather
 * than only relying on the browser's own failure UI.
 */
export function WatchLiveSection({ variant, status }: WatchLiveSectionProps) {
  const { t } = useLanguage();
  const katha = isKathaStatus(variant, status) ? status : null;

  const handleWatchLive = () => {
    if (!status.streamUrl) return;
    const win = window.open(status.streamUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.alert(t('liveDarshan.errors.unableToOpen'));
    }
  };

  return (
    <section className="rounded-card border border-black/10 bg-surface-light p-4 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-surface-dark">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-app-base font-semibold text-text-primary">
          {variant === 'darshan' ? t('liveDarshan.darshan.title') : t('liveDarshan.katha.title')}
        </h2>
        <LiveStatusBadge isLive={status.isLive} variant={variant} />
      </div>

      {katha && (katha.title || katha.speakerName || katha.kathaDate || katha.kathaTime) && (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-app-sm text-text-secondary">
          {katha.title && (
            <div className="col-span-2">
              <dt className="sr-only">{t('liveDarshan.katha.fields.title')}</dt>
              <dd className="font-medium text-text-primary">{katha.title}</dd>
            </div>
          )}
          {katha.speakerName && (
            <div>
              <dt className="sr-only">{t('liveDarshan.katha.fields.speaker')}</dt>
              <dd>{katha.speakerName}</dd>
            </div>
          )}
          {katha.kathaDate && (
            <div>
              <dt className="sr-only">{t('liveDarshan.katha.fields.date')}</dt>
              <dd>{new Date(katha.kathaDate).toLocaleDateString()}</dd>
            </div>
          )}
          {katha.kathaTime && (
            <div>
              <dt className="sr-only">{t('liveDarshan.katha.fields.time')}</dt>
              <dd>{katha.kathaTime}</dd>
            </div>
          )}
        </dl>
      )}

      {status.isLive && status.streamUrl ? (
        <button
          type="button"
          onClick={handleWatchLive}
          className="w-full rounded-card bg-saffron px-4 py-3 text-center text-app-base font-semibold text-white"
        >
          {t('liveDarshan.watchLive')}
        </button>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {status.streamUrl
            ? // Configured but not currently marked LIVE (FR-LIVE-003/FR-LIVE-007).
              variant === 'darshan'
              ? t('liveDarshan.darshan.unavailable')
              : t('liveDarshan.katha.notInProgress')
            : // Never configured at all (SRS 10.11 error handling).
              t('liveDarshan.errors.notConfigured')}
        </p>
      )}
    </section>
  );
}
