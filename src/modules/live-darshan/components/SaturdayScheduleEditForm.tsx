import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { ApiError } from '@shared/lib/functionsClient';
import { liveDarshanService } from '../services/liveDarshanService';
import type { SaturdayKathaSchedule } from '../types/liveDarshan.types';

interface SaturdayScheduleEditFormProps {
  sessionToken: string;
  schedule: SaturdayKathaSchedule | null;
  onSaved: (schedule: SaturdayKathaSchedule) => void;
}

/**
 * 10.9 "Edit Saturday Schedule" (Shreeji Yuvak Mandal Head / Supreme
 * Administrator). Only rendered by the caller when hasPermission
 * ('live_darshan', 'edit_saturday_schedule') is true — server-side
 * requirePermission() inside updateSaturdaySchedule is the real
 * authority.
 */
export function SaturdayScheduleEditForm({ sessionToken, schedule, onSaved }: SaturdayScheduleEditFormProps) {
  const { t } = useLanguage();

  const [eventDate, setEventDate] = useState(schedule?.event_date ?? '');
  const [eventTime, setEventTime] = useState(schedule?.event_time ?? '');
  const [venue, setVenue] = useState(schedule?.venue ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const updated = await liveDarshanService.updateSaturdaySchedule(sessionToken, {
        eventDate: eventDate || null,
        eventTime: eventTime || null,
        venue: venue.trim() || null,
      });
      setSuccessMessage(t('liveDarshan.admin.saved'));
      onSaved(updated);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('liveDarshan.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-black/10 p-4 dark:border-white/10">
      <h3 className="text-app-base font-semibold text-text-primary">{t('liveDarshan.admin.editSaturdaySchedule')}</h3>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
          {t('liveDarshan.saturdayKatha.fields.date')}
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
          {t('liveDarshan.saturdayKatha.fields.time')}
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
        {t('liveDarshan.saturdayKatha.fields.venue')}
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
      </label>

      {errorMessage && (
        <p role="alert" className="text-app-sm text-danger">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-app-sm text-saffron">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-card bg-saffron px-4 py-2 text-app-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? t('common.loading') : t('common.save')}
      </button>
    </form>
  );
}
