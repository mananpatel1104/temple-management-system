import { useLanguage } from '@app/providers/LanguageProvider';
import { LibraryCategoryCard } from '@modules/library/components/LibraryCategoryCard';
import { LIBRARY_CATEGORIES } from '@modules/library/config/libraryCategories.config';

/**
 * Library Home Screen (SRS Chapter 9 — Library Module; SRS 9.3 Library
 * Home Screen; SDD 8.1 MainLayout > RouteOutlet > LibraryScreen ->
 * ReaderComponent). Bottom Nav "Library" destination.
 *
 * Renders the Library categories in the order defined by
 * `LIBRARY_CATEGORIES`. As finalized in Task 7D, that order is: Aarti,
 * Ram Krishna Govind, Nitya Niyam, Janmangal, Official Vadtal Panchang,
 * Official Vadtal Nirnay, Kirtans, Granths, Stotra & Prarthana. This
 * supersedes the original SRS 9.3 ordering (which pinned Panchang and
 * Nirnay first). The order lives in libraryCategories.config.ts, the
 * single source of truth this screen renders from.
 *
 * This is the category-selection screen only — no devotional content
 * (Aarti/Kirtan/Stotra text, Panchang/Nirnay data, Granths) lives here or
 * is bundled into it. Every category currently routes to a "Coming Soon"
 * detail state (see LibraryCategoryScreen) since no reader, Panchang/
 * Nirnay data service, or verified content set has been built yet for any
 * of them — including Kirtans and Granths, which stay Coming Soon by
 * standing decision even once other categories gain real content.
 */
export function LibraryScreen() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-app-xl font-bold text-text-primary">
          {t('nav.library')}
        </h1>
        <p className="mt-1 text-app-base text-text-secondary">
          {t('library.subtitle')}
        </p>
      </header>

      <section aria-label={t('nav.library')} className="flex flex-col gap-3">
        {LIBRARY_CATEGORIES.map((category) => (
          <LibraryCategoryCard key={category.id} category={category} />
        ))}
      </section>
    </div>
  );
}
