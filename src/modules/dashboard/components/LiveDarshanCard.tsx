import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useOffline } from '@app/providers/OfflineProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { liveDarshanService } from '@modules/live-darshan/services/liveDarshanService';
import type { LiveDarshanStatus } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface LiveDarshanCardProps {
  /**
   * Optional — when omitted (the normal case, see HomeDashboard.tsx),
   * this component self-fetches Live Darshan status from the now-
   * implemented live-darshan module (Task 10D, SRS Chapter 10) via
   * liveDarshanService, matching AnnouncementsSection's self-fetch
   * pattern. Passing the prop explicitly (e.g. in a test) skips that
   * fetch and renders the given status as-is.
   */
  status?: LiveDarshanStatus;
}

/**
 * Live Darshan Card (SRS 8.8, FR-DASH-010/011). FR-DASH-010 specifies the
 * exact button copy for the unavailable state ("Live Darshan Currently
 * Unavailable"), which is what renders until a stream URL is configured.
 * FR-DASH-011 (pressing Live opens the configured stream) only applies
 * once `status.streamUrl` exists. Tapping the card itself (when not
 * live) opens the full Live Darshan & Katha screen (Task 10D).
 */
export function LiveDarshanCard({ status: statusProp }: LiveDarshanCardProps) {
  const { t } = useLanguage();
  const { isOffline } = useOffline();
  const { editorSession } = useAuth();
  const navigate = useNavigate();

  const [fetched, setFetched] = useState<LiveDarshanStatus | undefined>(undefined);

  useEffect(() => {
    if (statusProp !== undefined || isOffline) return;
    let cancelled = false;
    liveDarshanService
      .getStatus(editorSession?.sessionToken)
      .then((result) => {
        if (!cancelled) setFetched({ isLive: result.darshan.isLive, streamUrl: result.darshan.streamUrl });
      })
      .catch(() => {
        // Dashboard summary is best-effort — the full Live Darshan
        // screen surfaces load errors properly; this card just falls
        // back to its unavailable state on failure.
        if (!cancelled) setFetched(undefined);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusProp, isOffline, editorSession?.sessionToken]);

  const status = statusProp ?? fetched;
  const isLive = Boolean(status?.isLive && status.streamUrl);

  return (
    <DashboardCard title={t('dashboard.liveDarshan.title')} onSelect={() => navigate('/live-darshan')}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-app-sm font-semibold ${
            isLive
              ? 'bg-danger/10 text-danger'
              : 'bg-black/5 text-text-secondary dark:bg-white/10'
          }`}
        >
          {isLive ? t('dashboard.liveDarshan.liveStatus') : t('dashboard.liveDarshan.offlineStatus')}
        </span>

        {isLive ? (
          <span className="rounded-card bg-saffron px-4 py-2 text-app-sm font-semibold text-white">
            {t('dashboard.liveDarshan.title')}
          </span>
        ) : (
          <span className="text-app-sm text-text-secondary">
            {t('dashboard.liveDarshan.unavailable')}
          </span>
        )}
      </div>
    </DashboardCard>
  );
}
