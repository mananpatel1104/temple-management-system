import type { LibraryCategoryId } from '@modules/library/types/library.types';

/**
 * GLOBAL RULE — Library devotional content is Gujarati-only.
 * ============================================================
 * The selected app language (see LanguageProvider / useLanguage()) drives
 * the APP UI ONLY: navigation, buttons, headings, settings, Library
 * category names/descriptions, empty/"coming soon" states, and all other
 * general interface text. That system lives in `@i18n/i18n.config.ts`
 * and is untouched by this file.
 *
 * The actual devotional content displayed *inside* a Library category
 * (Aarti lyrics, Nitya Niyam text, Kirtan lyrics, Stotra & Prarthana
 * text, Janmangal text, Granth/devotional text, and anything else added
 * to the Library later) is a completely separate concern and must ALWAYS
 * be shown in Gujarati — regardless of whether the devotee selected
 * Gujarati, Hindi, or English as their app language.
 *
 * This file defines the *type-level* guarantee for that rule:
 *
 *  1. `LibraryContentLanguage` is a single-member literal union ('gu').
 *     There is intentionally no 'en' or 'hi' variant anywhere in this
 *     type. A devotional content item cannot be authored in, or
 *     requested in, any language other than Gujarati — the type system
 *     has no slot for that to happen.
 *  2. `LibraryContentItem` fields (`title`, `body`) are plain Gujarati
 *     strings, not `TranslationKey` lookups. They are never passed
 *     through `resolveTranslation()` / `t()` from `useLanguage()`, so
 *     changing the app language cannot affect what they resolve to —
 *     there is no resolution step keyed by language at all.
 *  3. Content is read via `useLibraryContent()` (see
 *     `../hooks/useLibraryContent.ts`), which takes only a
 *     `LibraryCategoryId` — it has no `language`/`SupportedLanguage`
 *     parameter for the UI language selector to feed into, even by
 *     accident.
 *
 * Do NOT add an `en`/`hi` field to this interface, a per-language content
 * map, or any lookup that keys devotional text off `SupportedLanguage`.
 * If a future task needs romanization or reference translations for
 * devotees who read English/Hindi script, that must be an explicitly
 * *additional*, clearly-labelled field (e.g. `referenceTranslationEn`)
 * that is never used to replace or select over `body` — the Gujarati
 * `body` must always be what's rendered as "the" content.
 */
export type LibraryContentLanguage = 'gu';

/**
 * A single piece of Gujarati devotional content belonging to one Library
 * category (Aarti lyrics, a Nitya Niyam text, a Kirtan, a Stotra/
 * Prarthana, a Granth excerpt, etc.).
 *
 * No devotional content has been authored yet (Task 6 → this task) — see
 * `../content/index.ts`, where every category's array is still empty.
 * This type only establishes the shape/architecture future tasks fill
 * in.
 */
export interface LibraryContentItem {
  /** Stable identifier, unique within its category (e.g. 'aarti-jay-sadguru-swami'). */
  id: string;
  /** Which Library category this item belongs to. */
  categoryId: LibraryCategoryId;
  /**
   * Source language of `title`/`body`. Always 'gu'. Kept as an explicit
   * field (rather than assumed) so it is self-documenting at every call
   * site and so any future attempt to introduce a non-'gu' item is a
   * type error, not a silent bug.
   */
  language: LibraryContentLanguage;
  /** Devotional title, authored in Gujarati script. */
  title: string;
  /** Devotional body text (lyrics/prayer/reading), authored in Gujarati script. */
  body: string;
  /** Display order within the category (ascending). */
  order: number;
}
