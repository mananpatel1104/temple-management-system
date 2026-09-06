import { Component, type ErrorInfo, type ReactNode } from 'react';
import { resolveTranslation, type TranslationKey } from '@i18n/i18n.config';
import { APP_CONFIG, type SupportedLanguage } from '@config/app.config';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level render-crash safety net (production-readiness: an uncaught
 * exception anywhere in the component tree would otherwise unmount the
 * whole React tree and leave the devotee looking at a blank white
 * screen, with no way back in short of force-quitting the app).
 *
 * This is a class component because React error boundaries require the
 * componentDidCatch/getDerivedStateFromError lifecycle, which has no
 * Hook equivalent. Because of that it cannot call useLanguage(), so it
 * reads the same 'ssm.language' localStorage key LanguageProvider
 * persists to and resolves copy directly via resolveTranslation() —
 * reusing existing, already-translated (en/gu/hi) strings rather than
 * introducing new ones.
 *
 * Deliberately generic and content-free, matching the existing
 * ComingSoon/NotFoundScreen pattern: no devotional text, no
 * feature-specific messaging.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Logged locally only — no network call, no PII, consistent with
    // every Edge Function's "log server-side, never leak raw error to
    // the client" pattern used elsewhere in this project.
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private currentLanguage(): SupportedLanguage {
    if (typeof window === 'undefined') return APP_CONFIG.defaultLanguage;
    const stored = window.localStorage.getItem('ssm.language');
    if (stored && (APP_CONFIG.supportedLanguages as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage;
    }
    return APP_CONFIG.defaultLanguage;
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const language = this.currentLanguage();
    const genericErrorKey: TranslationKey = 'announcements.errors.generic';
    const retryKey: TranslationKey = 'common.retry';
    const message = resolveTranslation(language, genericErrorKey);
    const retry = resolveTranslation(language, retryKey);

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-light px-4 text-center dark:bg-surface-dark">
        <p className="max-w-xs text-app-base text-text-secondary">{message}</p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="rounded-card bg-saffron px-6 py-3 text-app-base font-semibold text-white shadow-[var(--shadow-card)]"
        >
          {retry}
        </button>
      </div>
    );
  }
}
