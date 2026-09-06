import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { ApiError } from '@shared/lib/functionsClient';
import { liveDarshanService } from '../services/liveDarshanService';
import type { LiveDarshanStatusResult, LiveKathaStatusResult } from '../types/liveDarshan.types';

interface StreamConfigFormProps {
  sessionToken: string;
  variant: 'darshan' | 'katha';
  status: LiveDarshanStatusResult | LiveKathaStatusResult;
  onSaved: () => void;
}

/**
 * FR-LIVE-013/014 "Supreme Administrator shall be able to configure
 * Live Darshan Link and Live Katha Link ... Changing a stream link
 * shall immediately affect all users." Supreme-Administrator-only
 * screen real estate — the caller (LiveDarshanScreen) only renders this
 * when hasPermission('live_darshan', 'configure_stream') is true;
 * server-side enforcement is the actual authority (requirePermission()
 * inside the Edge Function's configureStream action), this is UI-level
 * only, per the task brief's "never rely on hiding buttons" instruction
 * — i.e. this form's existence is a convenience, not the security
 * boundary.
 */
export function StreamConfigForm({ sessionToken, variant, status, onSaved }: StreamConfigFormProps) {
  const { t } = useLanguage();
  const katha = variant === 'katha' ? (status as LiveKathaStatusResult) : null;

  const [streamUrl, setStreamUrl] = useState(status.streamUrl ?? '');
  const [isLive, setIsLive] = useState(status.isLive);
  const [title, setTitle] = useState(katha?.title ?? '');
  const [speakerName, setSpeakerName] = useState(katha?.speakerName ?? '');
  const [kathaDate, setKathaDate] = useState(katha?.kathaDate ?? '');
  const [kathaTime, setKathaTime] = useState(katha?.kathaTime ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await liveDarshanService.configureStream(sessionToken, {
        streamType: variant,
        streamUrl: streamUrl.trim() || null,
        isLive,
        ...(variant === 'katha'
          ? {
              title: title.trim() || null,
              speakerName: speakerName.trim() || null,
              kathaDate: kathaDate || null,
              kathaTime: kathaTime || null,
            }
          : {}),
      });
      setSuccessMessage(t('liveDarshan.admin.saved'));
      onSaved();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('liveDarshan.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-black/10 p-4 dark:border-white/10">
      <h3 className="text-app-base font-semibold text-text-primary">
        {variant === 'darshan' ? t('liveDarshan.admin.configureDarshan') : t('liveDarshan.admin.configureKatha')}
      </h3>

      <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
        {t('liveDarshan.admin.fields.streamUrl')}
        <input
          type="url"
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
      </label>

      {variant === 'katha' && (
        <>
          <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
            {t('liveDarshan.katha.fields.title')}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
            />
          </label>
          <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
            {t('liveDarshan.katha.fields.speaker')}
            <input
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
              {t('liveDarshan.katha.fields.date')}
              <input
                type="date"
                value={kathaDate}
                onChange={(e) => setKathaDate(e.target.value)}
                className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
              {t('liveDarshan.katha.fields.time')}
              <input
                type="time"
                value={kathaTime}
                onChange={(e) => setKathaTime(e.target.value)}
                className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
              />
            </label>
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-app-sm text-text-primary">
        <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
        {t('liveDarshan.admin.fields.markLive')}
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
