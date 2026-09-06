import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { HOME_PATH, REGISTRATION_PATH } from '@app/router/routes.config';
import { APP_CONFIG, LANGUAGE_NATIVE_NAMES, type SupportedLanguage } from '@config/app.config';

/**
 * Each language's name is shown in its OWN script — a devotee scanning
 * for Hindi needs to recognise "हिन्दी" on-screen, which wouldn't be true
 * if these labels were run through `t()` and rendered in whatever
 * language currently happens to be selected/default. Native names come
 * from the single shared LANGUAGE_NATIVE_NAMES map (app.config.ts) so
 * this remains the app's one and only language-selection list.
 */
const LANGUAGE_OPTIONS: { code: SupportedLanguage; nativeName: string }[] =
  APP_CONFIG.supportedLanguages.map((code) => ({
    code,
    nativeName: LANGUAGE_NATIVE_NAMES[code],
  }));

/**
 * Welcome Screen (SRS FR-AUTH-001/002, 24.6; SDD 8.1 App Shell ->
 * WelcomeScreen "first launch only"). Shows the Temple Logo, Temple Name,
 * "Jay Swaminarayan" greeting, a welcome message, the language selector
 * (Gujarati/Hindi/English — Gujarati pre-selected per APP_CONFIG's
 * default), and a Continue button.
 *
 * After language selection, Continue proceeds to the Registration
 * Screen (FR-AUTH-003 onward — Name + optional Mobile Number capture
 * and automatic Member ID generation, src/app/onboarding/
 * RegistrationScreen.tsx). If a member identity already exists locally
 * (e.g. the devotee changed language again from Settings later),
 * RequireRegistered/RedirectIfLanguageSelected send them straight to
 * the Home Dashboard instead — see RouteGuards.tsx.
 *
 * Returning devotees never see this screen again: RouteGuards redirects
 * away from "/" once LanguageProvider reports `hasSelectedLanguage`.
 */
export function WelcomeScreen() {
  const { language, t, confirmLanguage } = useLanguage();
  const { isRegistered } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SupportedLanguage>(
    language ?? APP_CONFIG.defaultLanguage,
  );

  const handleContinue = () => {
    confirmLanguage(selected);
    navigate(isRegistered ? HOME_PATH : REGISTRATION_PATH, { replace: true });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-2 py-8 text-center">
      <img
        src={`${import.meta.env.BASE_URL}icons/temple-logo.png`}
        alt={t('app.name')}
        className="h-24 w-24 rounded-full object-cover shadow-[var(--shadow-card-elevated)]"
      />

      <div className="space-y-1">
        <p className="text-app-xl font-bold text-saffron">
          {t('app.greeting')}
        </p>
        <h1 className="text-app-lg font-semibold text-text-primary">
          {t('app.name')}
        </h1>
        <p className="mx-auto max-w-xs text-app-base text-text-secondary">
          {t('welcome.message')}
        </p>
      </div>

      <fieldset className="w-full max-w-xs space-y-3">
        <legend className="mb-2 w-full text-center text-app-sm font-medium text-text-secondary">
          {t('welcome.selectLanguage')}
        </legend>
        <div role="radiogroup" aria-label={t('welcome.selectLanguage')}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={selected === option.code}
              onClick={() => setSelected(option.code)}
              className={`mb-3 w-full rounded-card border px-4 py-3 text-app-base transition-colors last:mb-0 ${
                selected === option.code
                  ? 'border-saffron bg-cream text-text-primary dark:bg-surface-dark'
                  : 'border-black/10 text-text-secondary dark:border-white/10'
              }`}
            >
              {option.nativeName}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={handleContinue}
        className="w-full max-w-xs rounded-card bg-saffron px-6 py-3 text-app-base font-semibold text-white shadow-[var(--shadow-card)]"
      >
        {t('welcome.continue')}
      </button>
    </div>
  );
}
