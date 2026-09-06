import { useLanguage } from '@app/providers/LanguageProvider';
import type { PanchangSummary } from '@modules/dashboard/types/dashboard.types';
import { DashboardCard } from './DashboardCard';

interface PanchangCardProps {
  /** Undefined until the Panchang data service (SRS Chapter 16) exists. */
  panchang?: PanchangSummary;
  /** Opens the full Panchang page (FR-DASH-004) once that route exists. */
  onOpenPanchang?: () => void;
}

/**
 * Daily Panchang Card (SRS 8.5, FR-DASH-003/004). Always near the top of
 * the dashboard per spec. Shows the official Vadtal Panchang fields once
 * a data source is wired up; until then it shows a honest "not yet
 * available" state rather than fabricated religious data — the
 * project's own instructions are explicit about never inventing content.
 */
export function PanchangCard({ panchang, onOpenPanchang }: PanchangCardProps) {
  const { t } = useLanguage();

  return (
    <DashboardCard
      title={t('dashboard.panchang.title')}
      onSelect={panchang && onOpenPanchang ? onOpenPanchang : undefined}
    >
      {panchang ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-app-sm text-text-secondary">
          <div>
            <dt className="text-text-secondary">{panchang.day}</dt>
            <dd className="text-text-primary">{panchang.gregorianDate}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">{panchang.tithi}</dt>
            <dd className="text-text-primary">
              {panchang.paksha}, {panchang.maas}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">↑ {panchang.sunrise}</dt>
          </div>
          <div>
            <dt className="text-text-secondary">↓ {panchang.sunset}</dt>
          </div>
        </dl>
      ) : (
        <p className="text-app-sm text-text-secondary">
          {t('dashboard.panchang.unavailable')}
        </p>
      )}
    </DashboardCard>
  );
}
