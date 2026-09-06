import { useMemo } from 'react';
import { LIBRARY_CONTENT } from '@modules/library/content';
import type { LibraryCategoryId } from '@modules/library/types/library.types';
import type { LibraryContentItem } from '@modules/library/types/libraryContent.types';

/**
 * Returns the Gujarati devotional content items for a Library category,
 * sorted by `order`.
 *
 * DELIBERATELY does NOT take or read the app UI language. Compare this
 * to `useLanguage().t(key)`, which resolves a `TranslationKey` against
 * the currently selected `SupportedLanguage` ('gu' | 'hi' | 'en') — that
 * mechanism is for UI copy only. Devotional content has exactly one
 * source language (see `LibraryContentLanguage`), so there is nothing
 * here for the app language to select between. A screen that renders
 * devotional content should call BOTH hooks side by side, e.g.:
 *
 *   const { t } = useLanguage();                    // UI copy — follows app language
 *   const items = useLibraryContent(category.id);   // devotional text — always Gujarati
 *
 * and must never pass `language` from `useLanguage()` into this hook or
 * into anything under `../content/`.
 */
export function useLibraryContent(
  categoryId: LibraryCategoryId,
): LibraryContentItem[] {
  return useMemo(() => {
    const items = LIBRARY_CONTENT[categoryId] ?? [];
    return [...items].sort((a, b) => a.order - b.order);
  }, [categoryId]);
}
