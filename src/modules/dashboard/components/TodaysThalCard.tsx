import { useLanguage } from '@app/providers/LanguageProvider';
import type { TodaysThalAssignment } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface TodaysThalCardProps {
  /** Undefined until the Daily Thal module (SRS Chapter 15) exists. */
  assignment?: TodaysThalAssignment;
}

/**
 * Today's Thal Card (SRS 8.7, FR-DASH-008/009). Per FR-DASH-009, devotees
 * only ever see "Thal Updated" after an edit — never editor identity —
 * so `assignment.wasUpdated` intentionally has no effect on what's shown
 * beyond that single word, by design.
 */
export function TodaysThalCard({ assignment }: TodaysThalCardProps) {
  const { t } = useLanguage();

  return (
    <DashboardCard title={t('dashboard.thal.title')}>
      {assignment ? (
        <div className="text-app-sm text-text-secondary">
          <p className="text-text-primary">{assignment.familyName}</p>
          <p>{assignment.date}</p>
          {assignment.wasUpdated ? (
            <p className="mt-1 text-saffron">{t('dashboard.thal.updated')}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.thal.unavailable')}
        </p>
      )}
    </DashboardCard>
  );
}
