import type { LibraryContentItem } from '@modules/library/types/libraryContent.types';

/**
 * "હવે મારા વહાલાને" — Nitya Niyam devotional text.
 *
 * Source: have_mara_valane.docx (Task 7B content upload). Text below is transcribed
 * verbatim in Gujarati script from that file — nothing has been
 * translated, transliterated, paraphrased, reworded, or added. See the
 * GLOBAL RULE in `../../types/libraryContent.types.ts`: this is
 * Gujarati-only devotional content and must render unchanged regardless
 * of the devotee's selected app UI language.
 *
 * Per Task 7B, the user-facing name of this item is the ORIGINAL FILE
 * NAME of the supplied source file (have_mara_valane.docx), not an invented or
 * translated title.
 */
export const HAVE_MARA_VALANE: LibraryContentItem = {
  id: 'nitya-niyam-have-mara-valane',
  categoryId: 'nitya-niyam',
  language: 'gu',
  title: 'have_mara_valane.docx',
  body: `હવે મારા વહાલાને
પદ - ૧ 

હવે મારા વહાલાને નહિ રે વિસારું રે,
શ્વાસ ઉચ્છ્‍વાસે† તે નિત્ય સંભારું રે. ૧

પડ્યું મારે સહજાનંદજી શું પાનું રે,
હવે હું તો કેમ કરી રાખીશ છાનું રે. ૨

આવ્યું મારે હરિવર વરવાનું ટાણું રે,
એ વર ન મળે ખરચે નાણું રે. ૩

એ વર ભાગ્ય વિના નવ ભાવે રે,
એ સ્નેહ લગ્ન વિના નવ આવે રે. ૪

દુરિજન મન રે માને તેમ કહેજ્યો રે,
સ્વામી મારા હૃદયાની ભીતર રહેજ્યો રે. ૫

હવે હું તો પૂરણ પદવીને પામી રે,
મળ્યા મુને નિષ્કુળાનંદના સ્વામી રે. ૬

†શ્વાસોચ્છ્‍વાસે

પદ - ૨ 

હવે મારા વહાલાનાં દર્શન સારુ,
હરિજન આવે હજારે હજારું. ૧

ઢોલિયે બિરાજે સહજાનંદ સ્વામી,
પૂરણ પુરુષોત્તમ અંતરજામી. ૨

સભા મધ્યે બેઠાં મુનિનાં વૃંદ;
તેમાં શોભે તારે વીંટ્યો જેમ ચંદ્ર. ૩

દુર્ગપુર ખેલ રચ્યો અતિ ભારી,
ભેળા રમે સાધુ અને બ્રહ્મચારી. ૪

તાળી પડે ઊપડતી અતિ સારી,
ધૂન્ય થાય ચૌદ લોક થકી ન્યારી. ૫

પાઘલડીમાં છોગલિયું અતિ શોભે,
જોઈ જોઈ હરિજનનાં મન લોભે. ૬

પધાર્યા વહાલો સર્વે તે સુખના રાશી,
સહજાનંદ અક્ષરધામના વાસી. ૭

ભાંગી મારી જન્મોજનમની ખામી,
મળ્યા મુને નિષ્કુળાનંદના સ્વામી. ૮`,
  order: 4,
};
