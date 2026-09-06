import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { LibraryCategoryIcon } from '@modules/library/components/LibraryCategoryIcon';
import type { LibraryCategoryConfig } from '@modules/library/types/library.types';

interface LibraryCategoryCardProps {
  category: LibraryCategoryConfig;
}

/**
 * A single Library Home Screen category row (SRS 9.3). Every category is
 * tappable — even 'coming-soon' ones — and navigates to its
 * `/library/:categoryId` detail route, which is responsible for showing
 * the right "not ready yet" state (SRS 9.18 Error Handling) rather than
 * disabling the row. That keeps the Home Screen itself unchanged as each
 * category gains real content in later tasks (SRS 9.2).
 *
 * Sized and spaced for elderly devotees (SRS 9.1/9.3, 24.19
 * Accessibility): full-width row, large icon, minimum 44px touch target
 * (enforced globally in globals.css), generous text size.
 */
export function LibraryCategoryCard({ category }: LibraryCategoryCardProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isComingSoon = category.status === 'coming-soon';

  return (
    <button
      type="button"
      onClick={() => navigate(`/library/${category.path}`)}
      className="flex w-full items-center gap-4 rounded-card border border-black/10 bg-surface-light p-4 text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-surface-dark"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-devotional)] text-white">
        <LibraryCategoryIcon name={category.icon} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-app-lg font-semibold text-text-primary">
            {t(category.titleKey)}
          </span>
          {isComingSoon ? (
            <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-app-sm text-text-secondary dark:bg-white/10">
              {t('common.soon')}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-app-base text-text-secondary">
          {t(category.descriptionKey)}
        </span>
      </span>

      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-text-secondary"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
