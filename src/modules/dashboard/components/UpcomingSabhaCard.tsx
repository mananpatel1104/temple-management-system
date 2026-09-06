import { useLanguage } from '@app/providers/LanguageProvider';
import type { UpcomingSabha } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface UpcomingSabhaCardProps {
  /** Undefined until a Sabha data source exists. */
  sabha?: UpcomingSabha;
}

/**
 * Upcoming Sabha Card (SRS 8.11, FR-DASH-016/017). FR-DASH-017 specifies
 * the exact fallback copy ("No Upcoming Sabha Scheduled"), which is what
 * always renders for now since no Sabha scheduling data source exists
 * yet.
 */
export function UpcomingSabhaCard({ sabha }: UpcomingSabhaCardProps) {
  const { t } = useLanguage();

  return (
    <DashboardCard title={t('dashboard.sabha.title')}>
      {sabha ? (
        <div className="text-app-sm text-text-secondary">
          <p className="text-app-base font-medium text-text-primary">{sabha.name}</p>
          <p>
            {sabha.date} · {sabha.time}
          </p>
          <p>{sabha.location}</p>
        </div>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.sabha.unavailable')}
        </p>
      )}
    </DashboardCard>
  );
}
