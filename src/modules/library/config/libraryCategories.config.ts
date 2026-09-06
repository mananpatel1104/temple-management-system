import type { LibraryCategoryConfig } from '@modules/library/types/library.types';

/**
 * Library Home Screen category registry (SRS 9.3). This array's order IS
 * the display order.
 *
 * Task 7D (final library classification & order, product decision)
 * supersedes the original SRS 9.3 fixed order — Panchang and Nirnay no
 * longer pin the top of the list. The final order groups categories with
 * real bundled devotional content first (Aarti, Ram Krishna Govind,
 * Nitya Niyam, Janmangal), followed by the remaining 'coming-soon'
 * categories (Official Vadtal Panchang, Official Vadtal Nirnay, Kirtans,
 * Granths, Stotra & Prarthana). Do not reorder further without an
 * explicit product decision.
 *
 * `status` reflects only whether that category's real content/reader
 * screen exists yet (see LibraryCategoryStatus). Every category was
 * 'coming-soon' as of Task 6 (Library Home Screen only). Task 7A flipped
 * 'aarti' and 'ram-krishna-govind' (formerly the "Daily Reading /
 * Future Expansion" slot — renamed by product decision, see
 * library.types.ts) to 'available' now that their Gujarati devotional
 * text is bundled (see ../content/index.ts). Task 7B flips 'nitya-niyam'
 * to 'available' now that its six Gujarati devotional items are bundled
 * (see ../content/index.ts and ../content/nitya-niyam/*.ts). Task 7C
 * added the 'janmangal' entry (also 'available') now that its two
 * Gujarati devotional items are bundled (see ../content/index.ts and
 * ../content/janmangal/*.ts). Kirtans and Granths are explicitly kept
 * 'coming-soon' by prior decision even once other categories gain real
 * content, since Granths requires the Supreme Administrator upload flow
 * (FR-LIB-011) and Kirtans requires its own verified lyric set
 * (FR-LIB-009), neither of which is in scope here. Panchang, Nirnay, and
 * Stotra & Prarthana also remain 'coming-soon' — not in scope for Task
 * 7A, 7B, 7C, or 7D.
 */
export const LIBRARY_CATEGORIES: LibraryCategoryConfig[] = [
  {
    id: 'aarti',
    path: 'aarti',
    icon: 'aarti',
    status: 'available',
    titleKey: 'library.categories.aarti.title',
    descriptionKey: 'library.categories.aarti.description',
  },
  {
    id: 'ram-krishna-govind',
    path: 'ram-krishna-govind',
    icon: 'ram-krishna-govind',
    status: 'available',
    titleKey: 'library.categories.ramKrishnaGovind.title',
    descriptionKey: 'library.categories.ramKrishnaGovind.description',
  },
  {
    id: 'nitya-niyam',
    path: 'nitya-niyam',
    icon: 'nitya-niyam',
    status: 'available',
    titleKey: 'library.categories.nityaNiyam.title',
    descriptionKey: 'library.categories.nityaNiyam.description',
  },
  {
    id: 'janmangal',
    path: 'janmangal',
    icon: 'janmangal',
    status: 'available',
    titleKey: 'library.categories.janmangal.title',
    descriptionKey: 'library.categories.janmangal.description',
  },
  {
    id: 'panchang',
    path: 'panchang',
    icon: 'panchang',
    status: 'coming-soon',
    titleKey: 'library.categories.panchang.title',
    descriptionKey: 'library.categories.panchang.description',
  },
  {
    id: 'nirnay',
    path: 'nirnay',
    icon: 'nirnay',
    status: 'coming-soon',
    titleKey: 'library.categories.nirnay.title',
    descriptionKey: 'library.categories.nirnay.description',
  },
  {
    id: 'kirtans',
    path: 'kirtans',
    icon: 'kirtans',
    status: 'coming-soon',
    titleKey: 'library.categories.kirtans.title',
    descriptionKey: 'library.categories.kirtans.description',
  },
  {
    id: 'granths',
    path: 'granths',
    icon: 'granths',
    status: 'coming-soon',
    titleKey: 'library.categories.granths.title',
    descriptionKey: 'library.categories.granths.description',
  },
  {
    id: 'stotra-prarthana',
    path: 'stotra-prarthana',
    icon: 'stotra-prarthana',
    status: 'coming-soon',
    titleKey: 'library.categories.stotraPrarthana.title',
    descriptionKey: 'library.categories.stotraPrarthana.description',
  },
];
