import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './ThemeProvider';
import { LanguageProvider } from './LanguageProvider';
import { OfflineProvider } from './OfflineProvider';
import { AuthProvider } from '@modules/auth/context/AuthContext';
import { env } from '@config/env';

/**
 * Composes every foundation-level provider in the correct order.
 * AuthProvider (Task 9) sits inside Language/Offline since it doesn't
 * affect them, but outside the router content so every route (guards
 * included) can call useAuth().
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter basename={env.basePath === '/' ? undefined : env.basePath}>
      <ThemeProvider>
        <LanguageProvider>
          <OfflineProvider>
            <AuthProvider>{children}</AuthProvider>
          </OfflineProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
