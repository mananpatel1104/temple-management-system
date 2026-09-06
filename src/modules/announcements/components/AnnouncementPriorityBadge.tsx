import { useLanguage } from '@app/providers/LanguageProvider';
import { ANNOUNCEMENT_PRIORITY_LABEL_KEYS } from '../config/announcementCategories.config';
import type { AnnouncementPriority } from '../types/announcement.types';

const PRIORITY_CLASSES: Record<AnnouncementPriority, string> = {
  // 12.8: High "appears at top" — the most visually distinct treatment.
  high: 'bg-danger/15 text-danger',
  medium: 'bg-saffron/15 text-saffron',
  low: 'bg-black/10 text-text-secondary dark:bg-white/10',
};

/** SRS 12.8 / Task 10B §4: "The UI must clearly distinguish priority where required." */
export function AnnouncementPriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-app-sm font-semibold ${PRIORITY_CLASSES[priority]}`}
    >
      {t(ANNOUNCEMENT_PRIORITY_LABEL_KEYS[priority])}
    </span>
  );
}
