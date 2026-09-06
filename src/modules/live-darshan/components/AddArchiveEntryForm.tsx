import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';
import { ApiError } from '@shared/lib/functionsClient';
import { liveDarshanService } from '../services/liveDarshanService';

interface AddArchiveEntryFormProps {
  sessionToken: string;
  onCreated: () => void;
}

/**
 * FR-LIVE-012 "The Supreme Administrator may archive ... outdated
 * recordings" / FR-LIVE-010 field list (Title, Date, Speaker (Optional),
 * Thumbnail (Optional), Watch link). This application never hosts
 * video (SDD 4.5) — the Watch field is always an external link.
 */
export function AddArchiveEntryForm({ sessionToken, onCreated }: AddArchiveEntryFormProps) {
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [kathaDate, setKathaDate] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [watchUrl, setWatchUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!title.trim()) {
      setErrorMessage(t('liveDarshan.admin.errors.titleRequired'));
      return;
    }
    if (!kathaDate) {
      setErrorMessage(t('liveDarshan.admin.errors.dateRequired'));
      return;
    }
    if (!watchUrl.trim()) {
      setErrorMessage(t('liveDarshan.admin.errors.watchUrlRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await liveDarshanService.createArchiveEntry(sessionToken, {
        title: title.trim(),
        kathaDate,
        speakerName: speakerName.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        watchUrl: watchUrl.trim(),
      });
      setTitle('');
      setKathaDate('');
      setSpeakerName('');
      setThumbnailUrl('');
      setWatchUrl('');
      onCreated();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('liveDarshan.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card border border-black/10 p-4 dark:border-white/10">
      <h3 className="text-app-base font-semibold text-text-primary">{t('liveDarshan.admin.addArchiveEntry')}</h3>

      <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
        {t('liveDarshan.archive.fields.title')}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
          {t('liveDarshan.archive.fields.date')}
          <input
            type="date"
            value={kathaDate}
            onChange={(e) => setKathaDate(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-app-sm text-text-secondary">
          {t('liveDarshan.archive.fields.speaker')}
          <input
            type="text"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
        {t('liveDarshan.archive.fields.thumbnail')}
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
      </label>

      <label className="flex flex-col gap-1 text-app-sm text-text-secondary">
        {t('liveDarshan.archive.fields.watchUrl')}
        <input
          type="url"
          value={watchUrl}
          onChange={(e) => setWatchUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-card border border-black/10 px-3 py-2 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
        />
      </label>

      {errorMessage && (
        <p role="alert" className="text-app-sm text-danger">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-card bg-saffron px-4 py-2 text-app-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? t('common.loading') : t('liveDarshan.admin.addArchiveEntry')}
      </button>
    </form>
  );
}
