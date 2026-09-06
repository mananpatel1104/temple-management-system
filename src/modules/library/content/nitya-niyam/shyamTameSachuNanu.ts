import type { LibraryContentItem } from '@modules/library/types/libraryContent.types';

/**
 * "રે શ્યામ તમે સાચું નાણું" — Nitya Niyam devotional text.
 *
 * Source: Shyam_tame_sachu_nanu.txt (Task 7B content upload). Text below is transcribed
 * verbatim in Gujarati script from that file — nothing has been
 * translated, transliterated, paraphrased, reworded, or added. See the
 * GLOBAL RULE in `../../types/libraryContent.types.ts`: this is
 * Gujarati-only devotional content and must render unchanged regardless
 * of the devotee's selected app UI language.
 *
 * Per Task 7B, the user-facing name of this item is the ORIGINAL FILE
 * NAME of the supplied source file (Shyam_tame_sachu_nanu.txt), not an invented or
 * translated title.
 */
export const SHYAM_TAME_SACHU_NANU: LibraryContentItem = {
  id: 'nitya-niyam-shyam-tame-sachu-nanu',
  categoryId: 'nitya-niyam',
  language: 'gu',
  title: 'Shyam_tame_sachu_nanu.txt',
  body: `રે શ્યામ તમે સાચું નાણું, બીજું સર્વે દુઃખદાયક જાણું... ꠶ટેક

રે તમ વિના સુખ સંપત કહાવે, તે તો સર્વે મહાદુઃખ ઉપજાવે;
અંતે એમાં કામ કોઈ નાવે... રે શ્યામ꠶ ૧

રે મૂરખ લોક મરે ભટકી, જૂઠા સંગે હારે શિર પટકી;
તેથી મારી મનવૃત્તિ અટકી... રે શ્યામ꠶ ૨

રે અખંડ અલૌકિક સુખ સારુ, રે જોઈ જોઈ મન મોહ્યું મારું;
ધરા ધન તમ ઉપર વારું... રે શ્યામ꠶ ૩

રે બ્રહ્માથી કીટ લગી જોયું, જૂઠું સુખ જાણીને વગોવ્યું;
મુક્તાનંદ મન તમ સંગ મોહ્યું... રે શ્યામ꠶ ૪`,
  order: 1,
};
