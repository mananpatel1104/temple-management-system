import { useLanguage } from '@app/providers/LanguageProvider';
import type { FestivalCountdown } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface FestivalCountdownCardProps {
  /** Undefined until the Festival Calendar module (SRS Chapter 16) exists. */
  festival?: FestivalCountdown;
  /** Opens the Festival Calendar page (FR-DASH-013), once that route exists. */
  onOpenFestivalCalendar?: () => void;
}

/**
 * Festival Countdown Card (SRS 8.9, FR-DASH-012/013). Shows the nearest
 * upcoming festival once Festival Calendar data is available; until then
 * it uses the same honest "not yet available" pattern as the other
 * data-dependent cards rather than fabricating a festival date.
 */
export function FestivalCountdownCard({
  festival,
  onOpenFestivalCalendar,
}: FestivalCountdownCardProps) {
  const { t } = useLanguage();

  return (
    <DashboardCard
      title={t('dashboard.festival.title')}
      onSelect={festival && onOpenFestivalCalendar ? onOpenFestivalCalendar : undefined}
    >
      {festival ? (
        <div className="text-app-sm text-text-secondary">
          <p className="text-app-base font-medium text-text-primary">
            {festival.festivalName}
          </p>
          <p>
            {festival.festivalDate} · {festival.remainingDays}{' '}
            {t('dashboard.festival.daysRemaining')}
          </p>
        </div>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.festival.unavailable')}
        </p>
      )}
    </DashboardCard>
  );
}
