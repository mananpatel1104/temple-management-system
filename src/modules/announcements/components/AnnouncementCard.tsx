import { useLanguage } from '@app/providers/LanguageProvider';
import { AnnouncementPriorityBadge } from './AnnouncementPriorityBadge';
import { AnnouncementCategoryBadge } from './AnnouncementCategoryBadge';
import type { Announcement } from '../types/announcement.types';

interface AnnouncementCardProps {
  announcement: Announcement;
  onSelect: () => void;
}

/** 12.16 list-item: title, category, priority, and a short preview of the content. */
export function AnnouncementCard({ announcement, onSelect }: AnnouncementCardProps) {
  const { t } = useLanguage();
  const isScheduled = announcement.status === 'scheduled';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-2 rounded-card border border-black/10 bg-surface-light p-4 text-left shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-surface-dark"
    >
      <div className="flex flex-wrap items-center gap-2">
        <AnnouncementCategoryBadge category={announcement.category} />
        <AnnouncementPriorityBadge priority={announcement.priority} />
        {isScheduled && (
          <span className="inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-app-sm text-text-secondary dark:bg-white/10">
            {t('announcements.status.scheduled')}
          </span>
        )}
        {announcement.is_archived && (
          <span className="inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-app-sm text-text-secondary dark:bg-white/10">
            {t('announcements.status.archived')}
          </span>
        )}
      </div>

      <h3 className="text-app-lg font-semibold text-text-primary">{announcement.title}</h3>
      <p className="line-clamp-2 text-app-sm text-text-secondary">{announcement.description}</p>
      <p className="text-app-sm text-text-secondary">
        {new Date(announcement.publish_at).toLocaleDateString()}
      </p>
    </button>
  );
}
