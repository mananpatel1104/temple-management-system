import { useLanguage } from '@app/providers/LanguageProvider';

interface LiveStatusBadgeProps {
  isLive: boolean;
  /** FR-LIVE-006: Live Katha uses "🔴 LIVE NOW" instead of plain "🔴 LIVE" (FR-LIVE-002). */
  variant?: 'darshan' | 'katha';
}

/**
 * Shared 🔴 LIVE / OFFLINE indicator (FR-LIVE-002/006, SRS 10.10 "clear
 * LIVE indicator"). Kept local to this module since no other module has
 * this exact live/offline chip.
 */
export function LiveStatusBadge({ isLive, variant = 'darshan' }: LiveStatusBadgeProps) {
  const { t } = useLanguage();

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-app-sm font-semibold ${
        isLive ? 'bg-danger/10 text-danger' : 'bg-black/5 text-text-secondary dark:bg-white/10'
      }`}
    >
      {isLive ? (
        <>
          <span aria-hidden="true">🔴</span>
          {variant === 'katha' ? t('liveDarshan.katha.liveNow') : t('liveDarshan.darshan.live')}
        </>
      ) : (
        t('liveDarshan.darshan.offline')
      )}
    </span>
  );
}
