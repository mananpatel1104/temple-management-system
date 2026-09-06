import type { TranslationKey } from '@i18n/i18n.config';

/**
 * Library Home Screen category identifiers (SRS 9.3), also used as the
 * `/library/:categoryId` route segment. Order is NOT derived from this
 * type — it comes from the array order in `libraryCategories.config.ts`,
 * which is the single source of truth for the Library's display order
 * (see the Task 7D note below).
 *
 * The slot originally described in SRS 9.3 as "Daily Reading (Future
 * Expansion)" has been renamed to `ram-krishna-govind` (Task 7A, product
 * decision): it is no longer a placeholder — it now holds the Ram
 * Krishna Govind devotional chant recited after Aarti. Only its
 * identity/content changed; its position is governed by the Task 7D
 * order below.
 *
 * `janmangal` is a 9th category added in Task 7C (product decision) to
 * hold the Janmangal Stotra and Janmangal Namavali devotional texts.
 *
 * Task 7D (product decision) finalized the display order in
 * `libraryCategories.config.ts`: Aarti, Ram Krishna Govind, Nitya Niyam,
 * and Janmangal (all 'available') now lead the list, followed by
 * Panchang, Nirnay, Kirtans, Granths, and Stotra & Prarthana (all
 * 'coming-soon'). This supersedes the original SRS 9.3 ordering. This
 * union's own member order is not meaningful for display purposes.
 */
export type LibraryCategoryId =
  | 'panchang'
  | 'nirnay'
  | 'aarti'
  | 'nitya-niyam'
  | 'kirtans'
  | 'granths'
  | 'stotra-prarthana'
  | 'ram-krishna-govind'
  | 'janmangal';

/**
 * Availability of a category's real content/reader screen. As of Task 6
 * every category was 'coming-soon' — no reader, Panchang/Nirnay data
 * service, or bundled devotional text had been built yet for any of
 * them. This flag exists so later tasks can flip a category to
 * 'available' without touching the Home Screen's structure (SRS 9.2:
 * "allow future expansion without changing the application structure").
 *
 * Task 7A flipped 'aarti' and 'ram-krishna-govind' to 'available' now
 * that their Gujarati devotional text has been bundled (see
 * `../content/index.ts`). Task 7B flips 'nitya-niyam' to 'available' now
 * that its six Gujarati devotional items are bundled. Task 7C adds the
 * new 'janmangal' category, also 'available', now that its two Gujarati
 * devotional items (Janmangal Stotra, Janmangal Namavali) are bundled.
 * Kirtans, Granths, Stotra & Prarthana, Panchang, and Nirnay remain
 * 'coming-soon' by standing decision — do not change their status
 * without an explicit content-authoring task for that category.
 */
export type LibraryCategoryStatus = 'available' | 'coming-soon';

/** Inline icon glyph rendered on a category's card — see LibraryCategoryIcon.tsx. */
export type LibraryCategoryIconName =
  | 'panchang'
  | 'nirnay'
  | 'aarti'
  | 'nitya-niyam'
  | 'kirtans'
  | 'granths'
  | 'stotra-prarthana'
  | 'ram-krishna-govind'
  | 'janmangal';

export interface LibraryCategoryConfig {
  id: LibraryCategoryId;
  /** Route segment under /library, e.g. /library/aarti. */
  path: string;
  icon: LibraryCategoryIconName;
  status: LibraryCategoryStatus;
  /** Card title (SRS 9.3 category name). */
  titleKey: TranslationKey;
  /** One-line card description shown under the title. */
  descriptionKey: TranslationKey;
}
