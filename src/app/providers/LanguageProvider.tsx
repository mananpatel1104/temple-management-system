import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { APP_CONFIG, type SupportedLanguage } from '@config/app.config';
import { resolveTranslation, type TranslationKey } from '@i18n/i18n.config';

const LANGUAGE_STORAGE_KEY = 'ssm.language';
/**
 * Separate from LANGUAGE_STORAGE_KEY on purpose: the language value
 * always has a default ('gu' — APP_CONFIG.defaultLanguage), so its mere
 * presence in storage can't tell us whether the devotee has actually
 * been through the Welcome Screen (FR-AUTH-001/002) yet. This flag is
 * only ever set by confirmLanguage(), called from the Welcome Screen's
 * Continue button.
 */
const LANGUAGE_CONFIRMED_STORAGE_KEY = 'ssm.language.confirmed';

interface LanguageContextValue {
  language: SupportedLanguage;
  /** Change the active language at any time (e.g. More > Change Language). */
  setLanguage: (language: SupportedLanguage) => void;
  /**
   * True once the devotee has completed first-launch language selection
   * (FR-AUTH-002). Drives the Welcome Screen <-> main app routing guard —
   * see src/app/router/RouteGuards.tsx.
   */
  hasSelectedLanguage: boolean;
  /** Set the language AND mark first-launch selection as complete. */
  confirmLanguage: (language: SupportedLanguage) => void;
  /** Translate a foundation-level key (app.*, common.*, nav.*, etc.). */
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

function readStoredLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return APP_CONFIG.defaultLanguage;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (
    stored &&
    (APP_CONFIG.supportedLanguages as readonly string[]).includes(stored)
  ) {
    return stored as SupportedLanguage;
  }
  return APP_CONFIG.defaultLanguage;
}

function readConfirmed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LANGUAGE_CONFIRMED_STORAGE_KEY) === '1';
}

/**
 * LanguageProvider (SRS 24.4 Typography / 24.6 Welcome Screen language
 * selection / 24.15 More Screen — Change Language).
 * Persists the selected language (and whether first-launch selection has
 * been confirmed) to localStorage — this is synchronous and works fully
 * offline, so the choice survives reloads/app restarts without any
 * network access (TECH-004/DP-005). Also sets <html lang> + a
 * data-lang-font attribute (see globals.css) so Gujarati/Hindi/English
 * render with the correct typeface throughout the app.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] =
    useState<SupportedLanguage>(readStoredLanguage);
  const [hasSelectedLanguage, setHasSelectedLanguage] =
    useState<boolean>(readConfirmed);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('data-lang-font', language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
  }, []);

  const confirmLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
    setHasSelectedLanguage(true);
    window.localStorage.setItem(LANGUAGE_CONFIRMED_STORAGE_KEY, '1');
  }, []);

  const t = useCallback(
    (key: TranslationKey) => resolveTranslation(language, key),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, hasSelectedLanguage, confirmLanguage, t }),
    [language, setLanguage, hasSelectedLanguage, confirmLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
