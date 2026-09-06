import { useLanguage } from '@app/providers/LanguageProvider';
import type { SaturdayKathaSchedule } from '../types/liveDarshan.types';

interface SaturdayKathaCardProps {
  schedule: SaturdayKathaSchedule | null;
}

/**
 * FR-LIVE-008/009 — Saturday Katha reminder (Day/Date/Time/Venue).
 * Visibility itself (Shreeji Yuvak Mandal Head / Trustee / Supreme
 * Administrator only) is enforced by the caller not rendering this
 * component at all for other roles — see LiveDarshanScreen, which only
 * fetches/renders this when hasPermission('live_darshan',
 * 'view_saturday_schedule') is true, matching FR-LIVE-009 "remain
 * hidden from other users" (not merely disabled/greyed out).
 */
export function SaturdayKathaCard({ schedule }: SaturdayKathaCardProps) {
  const { t } = useLanguage();

  const hasDetails = Boolean(schedule?.event_date || schedule?.event_time || schedule?.venue);

  return (
    <section className="rounded-card border border-black/10 bg-surface-light p-4 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-surface-dark">
      <h2 className="mb-2 text-app-base font-semibold text-text-primary">{t('liveDarshan.saturdayKatha.title')}</h2>
      {hasDetails && schedule ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-app-sm text-text-secondary">
          <div className="col-span-2">
            <dt className="sr-only">{t('liveDarshan.saturdayKatha.fields.day')}</dt>
            <dd className="font-medium text-text-primary">{schedule.day_label}</dd>
          </div>
          {schedule.event_date && (
            <div>
              <dt className="sr-only">{t('liveDarshan.saturdayKatha.fields.date')}</dt>
              <dd>{new Date(schedule.event_date).toLocaleDateString()}</dd>
            </div>
          )}
          {schedule.event_time && (
            <div>
              <dt className="sr-only">{t('liveDarshan.saturdayKatha.fields.time')}</dt>
              <dd>{schedule.event_time}</dd>
            </div>
          )}
          {schedule.venue && (
            <div className="col-span-2">
              <dt className="sr-only">{t('liveDarshan.saturdayKatha.fields.venue')}</dt>
              <dd>{schedule.venue}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-app-sm text-text-secondary">{t('liveDarshan.saturdayKatha.empty')}</p>
      )}
    </section>
  );
}
