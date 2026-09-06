import { useParams, Link, Navigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { LIBRARY_CATEGORIES } from '@modules/library/config/libraryCategories.config';
import { LibraryCategoryIcon } from '@modules/library/components/LibraryCategoryIcon';
import { useLibraryContent } from '@modules/library/hooks/useLibraryContent';

/**
 * Library category detail route (`/library/:categoryId`). SDD 8.1 names
 * this destination `ReaderComponent`; for Task 6 (Library Home Screen)
 * every category is still `status: 'coming-soon'` (see
 * libraryCategories.config.ts), so this renders the SRS 9.18 "not yet
 * available" state rather than any real reader. Once a category's real
 * content/reader is built, only its config entry's `status` needs to
 * change — this route and the Home Screen stay as-is.
 *
 * An unknown category id (e.g. a stale/typed-in URL) falls back to the
 * app's normal 404 screen instead of a blank page.
 *
 * LANGUAGE RULE (see libraryContent.types.ts): `t(...)` below resolves
 * app-UI copy (back link, category title, "coming soon" message) against
 * the devotee's selected app language via `useLanguage()`.
 * `useLibraryContent()` is a separate call that is never given that
 * language and always returns Gujarati devotional text — that is what a
 * future reader built here renders for `item.title`/`item.body`,
 * verbatim, with no `t()`/translation lookup applied to them.
 */
export function LibraryCategoryScreen() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { t } = useLanguage();

  const category = LIBRARY_CATEGORIES.find((c) => c.path === categoryId);
  // Always resolved from the Gujarati-only content registry (see
  // ../hooks/useLibraryContent.ts and ../content/index.ts). Every
  // registry entry is still empty as of this task — no devotional
  // content has been authored — so `hasReadableContent` below is always
  // false today and the existing "coming soon" UI renders unchanged.
  // This wiring exists so a future task can flip a category's `status`
  // to 'available' and add items to the registry without touching this
  // screen's structure again.
  const contentItems = useLibraryContent(category?.id ?? 'aarti');

  if (!category) {
    return <Navigate to="/not-found" replace />;
  }

  const hasReadableContent =
    category.status === 'available' && contentItems.length > 0;

  const backLink = (
    <Link
      to="/library"
      className="mb-4 inline-flex w-fit items-center gap-1 text-app-base font-medium text-saffron"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
      {t('library.detail.backToLibrary')}
    </Link>
  );

  if (hasReadableContent) {
    return (
      <div className="flex flex-1 flex-col">
        {backLink}

        {/* Category title follows the app UI language (SRS 9.3 card title). */}
        <h1 className="mb-4 text-app-xl font-bold text-text-primary">
          {t(category.titleKey)}
        </h1>

        {/*
          Devotional content: intentionally NOT passed through t()/
          resolveTranslation(). item.title/item.body come straight from
          the Gujarati-only registry and must render as-authored
          regardless of the selected app language. `lang="gu"` documents
          that intent for assistive tech even while the surrounding UI
          may be in English/Hindi.
        */}
        <div className="flex flex-col gap-6" lang="gu">
          {contentItems.map((item) => (
            <article key={item.id}>
              <h2 className="text-app-lg font-semibold text-text-primary">
                {item.title}
              </h2>
              <p className="mt-2 whitespace-pre-line text-app-base text-text-secondary">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {backLink}

      <section className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[image:var(--gradient-devotional)] text-white">
          <LibraryCategoryIcon name={category.icon} />
        </span>
        <h1 className="text-app-xl font-bold text-text-primary">
          {t(category.titleKey)}
        </h1>
        <p className="max-w-xs text-app-base text-text-secondary">
          {t('common.comingSoon')}
        </p>
      </section>
    </div>
  );
}
