import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { announcementService } from '@modules/announcements/services/announcementService';
import type { AnnouncementSummary } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface AnnouncementsSectionProps {
  /**
   * Role-filtered, newest-first (FR-DASH-014/015). Optional — when
   * omitted (the normal case, see HomeDashboard.tsx), this component
   * fetches it itself from the now-implemented Announcements module
   * (Task 10B, SRS Chapter 12) via announcementService, honoring the
   * exact same server-side VisibilityResolver as the full Announcements
   * screen. Passing the prop explicitly (e.g. in a test) skips that
   * fetch and renders the given list as-is.
   */
  announcements?: AnnouncementSummary[];
}

/**
 * Announcements Section (SRS 8.10, FR-DASH-014/015). "View All" always
 * navigates to the real Announcements screen (Task 10B).
 */
export function AnnouncementsSection({ announcements: announcementsProp }: AnnouncementsSectionProps) {
  const { t } = useLanguage();
  const { editorSession } = useAuth();
  const navigate = useNavigate();

  const [fetched, setFetched] = useState<AnnouncementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(announcementsProp === undefined);

  useEffect(() => {
    if (announcementsProp !== undefined) return;
    let cancelled = false;
    setIsLoading(true);
    announcementService
      .list({ view: 'active', limit: 5 }, editorSession?.sessionToken)
      .then((result) => {
        if (cancelled) return;
        setFetched(
          result.announcements.map((a) => ({
            id: a.announcement_id,
            title: a.title,
            publishedAt: new Date(a.publish_at).toLocaleDateString(),
            priority: a.priority,
          })),
        );
      })
      .catch(() => {
        // Dashboard summary is best-effort — the full Announcements
        // screen (via "View All") surfaces load errors properly; this
        // card just falls back to its empty state on failure.
        if (!cancelled) setFetched([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementsProp, editorSession?.sessionToken]);

  const announcements = announcementsProp ?? fetched;

  return (
    <DashboardCard title={t('nav.announcements')}>
      {isLoading ? (
        <p className="text-app-sm text-text-secondary">{t('common.loading')}</p>
      ) : announcements.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {announcements.map((item) => (
            <li key={item.id} className="text-app-sm text-text-primary">
              {item.title}
              <span className="ml-2 text-text-secondary">{item.publishedAt}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.announcements.empty')}
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate('/announcements')}
        className="mt-3 text-app-sm font-semibold text-saffron"
      >
        {t('dashboard.announcements.viewAll')}
      </button>
    </DashboardCard>
  );
}
