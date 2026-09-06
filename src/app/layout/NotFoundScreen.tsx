import { Link } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { HOME_PATH } from '@app/router/routes.config';

/**
 * Catch-all 404 screen for unmatched routes. Replaces the temporary
 * FoundationStatus scaffold's `notFound` variant.
 */
export function NotFoundScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <p className="text-app-xl font-bold text-saffron">{t('notFound.title')}</p>
      <p className="max-w-xs text-app-base text-text-secondary">
        {t('notFound.message')}
      </p>
      <Link
        to={HOME_PATH}
        className="mt-2 rounded-card bg-saffron px-6 py-3 text-app-base font-semibold text-white shadow-[var(--shadow-card)]"
      >
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}
