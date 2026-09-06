import type { LibraryContentItem } from '@modules/library/types/libraryContent.types';

/**
 * "પોઢે પ્રભુ" — Nitya Niyam devotional text.
 *
 * Source: Podhe_prabhu.txt (Task 7B content upload). Text below is transcribed
 * verbatim in Gujarati script from that file — nothing has been
 * translated, transliterated, paraphrased, reworded, or added. See the
 * GLOBAL RULE in `../../types/libraryContent.types.ts`: this is
 * Gujarati-only devotional content and must render unchanged regardless
 * of the devotee's selected app UI language.
 *
 * Per Task 7B, the user-facing name of this item is the ORIGINAL FILE
 * NAME of the supplied source file (Podhe_prabhu.txt), not an invented or
 * translated title.
 */
export const PODHE_PRABHU: LibraryContentItem = {
  id: 'nitya-niyam-podhe-prabhu',
  categoryId: 'nitya-niyam',
  language: 'gu',
  title: 'Podhe_prabhu.txt',
  body: `પોઢે પ્રભુ સકલ મુનિકે શ્યામ;
સ્વામિનારાયણ દિવ્ય મૂર્તિ, સંતનકે વિશ્રામ... ꠶ટેક

અક્ષર પર આનંદઘન પ્રભુ, કિયો હે ભૂપર ઠામ;
જેહી મિલત જન તરત માયા, લહત અક્ષરધામ... પોઢે꠶ ૧

શારદ શેષ મહેશ મહામુનિ, જપત જેહી ગુણનામ;
જાસ પદરજ શીશ ધરી ધરી, હોત જન નિષ્કામ... પોઢે꠶ ૨

પ્રેમકે પર્યંક પર પ્રભુ, કરત સુખ આરામ;
મુક્તાનંદ નિજ ચરણ ઢિગ ગુન, ગાવત આઠું જામ... પોઢે꠶ ૩`,
  order: 3,
};
