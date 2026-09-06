import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { APP_CONFIG, type SupportedTheme } from '@config/app.config';

const THEME_STORAGE_KEY = 'ssm.theme';

type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The user's stored preference: 'light' | 'dark' | 'system'. */
  theme: SupportedTheme;
  /** The theme actually applied to the DOM ('system' resolved to light/dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: SupportedTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStoredTheme(): SupportedTheme {
  if (typeof window === 'undefined') return APP_CONFIG.defaultTheme;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return APP_CONFIG.defaultTheme;
}

/**
 * ThemeProvider (SRS 24.2 / 24.15 More Screen — Theme selection).
 * Persists the user's choice to localStorage and applies it as a
 * `data-theme` attribute + `dark` class on <html>, matching the CSS
 * custom-property tokens in src/styles/themes/.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SupportedTheme>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === 'system' ? getSystemTheme() : theme,
  );

  const applyToDocument = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.classList.toggle('dark', resolved === 'dark');
  }, []);

  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyToDocument(resolved);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, applyToDocument]);

  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyToDocument(resolved);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyToDocument]);

  const setTheme = useCallback((next: SupportedTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
