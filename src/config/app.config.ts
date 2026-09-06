/**
 * Non-feature, project-wide configuration constants.
 * Feature-specific configuration belongs inside its own module folder.
 */
import { env } from '@config/env';

export const APP_CONFIG = {
  name: env.appName,
  defaultLanguage: 'gu' as const,
  supportedLanguages: ['gu', 'hi', 'en'] as const,
  defaultTheme: 'system' as const,
  supportedThemes: ['light', 'dark', 'system'] as const,
} as const;

export type SupportedLanguage = (typeof APP_CONFIG.supportedLanguages)[number];
export type SupportedTheme = (typeof APP_CONFIG.supportedThemes)[number];

/**
 * Each language's own name, in its own script (a devotee scanning for
 * Hindi needs to recognise "हिन्दी", not a translated label). Single
 * source of truth for anywhere a language code needs a human-readable
 * name — the Welcome Screen's language selector, the Preferred
 * Language confirmation on Registration, and its read-only display in
 * Member Management — so there is exactly one language list/label set
 * in the app, never a second one.
 */
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {
  gu: 'ગુજરાતી',
  hi: 'हिन्दी',
  en: 'English',
};
