import { useLanguage } from '@app/providers/LanguageProvider';
import { ANNOUNCEMENT_CATEGORIES } from '../config/announcementCategories.config';
import type { AnnouncementCategory } from '../types/announcement.types';

export function AnnouncementCategoryBadge({ category }: { category: AnnouncementCategory }) {
  const { t } = useLanguage();
  const config = ANNOUNCEMENT_CATEGORIES.find((c) => c.id === category);
  if (!config) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-black/10 px-2.5 py-0.5 text-app-sm text-text-secondary dark:border-white/10">
      {t(config.labelKey)}
    </span>
  );
}
