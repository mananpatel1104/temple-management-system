import type { LibraryCategoryId } from '@modules/library/types/library.types';
import type { LibraryContentItem } from '@modules/library/types/libraryContent.types';
import { JAY_SADGURU_SWAMI_AARTI } from '@modules/library/content/aarti/jaySadguruSwami';
import { RAM_KRISHNA_GOVIND } from '@modules/library/content/ram-krishna-govind/ramKrishnaGovind';
import { SHYAM_TAME_SACHU_NANU } from '@modules/library/content/nitya-niyam/shyamTameSachuNanu';
import { AAJ_MARE_ORDE_RE } from '@modules/library/content/nitya-niyam/aajMareOrdeRe';
import { PODHE_PRABHU } from '@modules/library/content/nitya-niyam/podhePrabhu';
import { HAVE_MARA_VALANE } from '@modules/library/content/nitya-niyam/haveMaraValane';
import { CHESTA } from '@modules/library/content/nitya-niyam/chesta';
import { AORA_AAVO } from '@modules/library/content/nitya-niyam/aoraAavo';
import { JANMANGAL_STOTRA } from '@modules/library/content/janmangal/janmangalStotra';
import { JANMANGAL_NAMAVALI } from '@modules/library/content/janmangal/janmangalNamavali';

/**
 * Devotional content registry — Gujarati-only source of truth.
 *
 * See `../types/libraryContent.types.ts` for the full rule this
 * implements. In short: this registry (and only this registry, plus any
 * future data-service that returns the same `LibraryContentItem` shape)
 * is where Aarti/Nitya Niyam/Kirtan/Stotra & Prarthana/Granth text lives.
 * It is never routed through `@i18n/i18n.config.ts`, `resolveTranslation()`,
 * or `useLanguage()` — the app UI language has no wiring into this file
 * at all, which is what makes it impossible for the language selector to
 * accidentally replace this content with an English/Hindi variant (there
 * is no English/Hindi variant to switch to).
 *
 * Keyed by `LibraryCategoryId` so every category (including ones that
 * are structurally content-free, like 'panchang'/'nirnay', which are
 * data-driven rather than devotional-text-driven) has an explicit, typed
 * entry.
 *
 * Task 7A populated the `aarti` and `ram-krishna-govind` arrays with the
 * first devotional items (see `./aarti/jaySadguruSwami.ts` and
 * `./ram-krishna-govind/ramKrishnaGovind.ts`), transcribed verbatim in
 * Gujarati from the supplied source files.
 *
 * Task 7B populates `nitya-niyam` with six items — one per supplied
 * Nitya Niyam source file (see `./nitya-niyam/*.ts`), each transcribed
 * verbatim in Gujarati with no translation, paraphrasing, or invented
 * content. Each item's `title` is the ORIGINAL FILE NAME of its source
 * file (per Task 7B instructions), not an authored song title. Order
 * follows the order the source files were supplied in.
 *
 * Task 7C populates the new `janmangal` category with two items — the
 * Janmangal Stotra (see `./janmangal/janmangalStotra.ts`, transcribed
 * verbatim from Janmangal_stotra.txt) and the Janmangal Namavali (see
 * `./janmangal/janmangalNamavali.ts`, transcribed verbatim from the
 * supplied janmangal_namavali_gujarati.docx — the .docx itself is never
 * shown as the reader, only its extracted text). Per Task 7C, each
 * item's `title` is the exact user-facing name specified by the task
 * ("Janmangal Stotra" / "Janmangal Namavali"), not a translated or
 * invented title. The two items are kept completely separate and are
 * never merged.
 *
 * Kirtans, Granths, and Stotra & Prarthana are intentionally left EMPTY —
 * no content, translated, paraphrased, corrected, or otherwise, has been
 * authored for them. Do not add real Kirtan/Stotra/Granth text here
 * without an explicit content-authoring task for that category.
 */
export const LIBRARY_CONTENT: Record<LibraryCategoryId, LibraryContentItem[]> = {
  panchang: [],
  nirnay: [],
  aarti: [JAY_SADGURU_SWAMI_AARTI],
  'nitya-niyam': [
    SHYAM_TAME_SACHU_NANU,
    AAJ_MARE_ORDE_RE,
    PODHE_PRABHU,
    HAVE_MARA_VALANE,
    CHESTA,
    AORA_AAVO,
  ],
  kirtans: [],
  granths: [],
  'stotra-prarthana': [],
  'ram-krishna-govind': [RAM_KRISHNA_GOVIND],
  janmangal: [JANMANGAL_STOTRA, JANMANGAL_NAMAVALI],
};
