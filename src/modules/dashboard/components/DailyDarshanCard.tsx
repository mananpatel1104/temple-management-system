import { useLanguage } from '@app/providers/LanguageProvider';
import type { DailyDarshanPhoto } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface DailyDarshanCardProps {
  /** Undefined until Daily Darshan uploads (Gallery module, FR-GAL-002) exist. */
  photo?: DailyDarshanPhoto;
  /** Opens the photo full-screen with zoom (FR-DASH-006), once available. */
  onOpenFullScreen?: () => void;
}

/**
 * Daily Darshan Card (SRS 8.6, FR-DASH-005/006/007). FR-DASH-007 defines
 * the exact fallback copy for when no photo has been uploaded yet, which
 * is the only state this can render until the Gallery/Daily-Darshan
 * upload pipeline exists.
 */
export function DailyDarshanCard({ photo, onOpenFullScreen }: DailyDarshanCardProps) {
  const { t } = useLanguage();

  return (
    <DashboardCard
      title={t('dashboard.darshan.title')}
      onSelect={photo && onOpenFullScreen ? onOpenFullScreen : undefined}
    >
      {photo ? (
        <figure>
          <img
            src={photo.photoUrl}
            alt={t('dashboard.darshan.title')}
            className="mb-2 aspect-square w-full rounded-card object-cover"
          />
          <figcaption className="text-app-sm text-text-secondary">
            {photo.uploadDate} · {photo.uploadedByName}
          </figcaption>
        </figure>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.darshan.unavailable')}
        </p>
      )}
    </DashboardCard>
  );
}
