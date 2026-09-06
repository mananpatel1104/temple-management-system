import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { HOME_PATH } from '@app/router/routes.config';
import { ApiError } from '@shared/lib/functionsClient';
import { LANGUAGE_NATIVE_NAMES } from '@config/app.config';

/**
 * Registration Screen (FR-AUTH-003/004/005, FR-MEM-001/002, SRS 22.4).
 * Shown once, immediately after language selection, before the devotee
 * ever reaches the Home Dashboard. Captures Name (required) and Mobile
 * Number (optional — "stored only as optional contact information...
 * NOT used for login, OTP, verification, or password recovery",
 * FR-AUTH-003), then the application automatically generates a
 * permanent Member ID (FR-AUTH-004) and the devotee is taken straight
 * to the Home Dashboard, never seeing this screen again unless they log
 * out or clear app data (FR-AUTH-005).
 *
 * Preferred Language (SRS 22.4) is NOT re-asked here — it comes
 * straight from the language the devotee already chose on the Welcome
 * Screen (useLanguage().language), which is the app's one and only
 * language-selection flow. This screen only shows a small read-only
 * confirmation of that choice.
 */
export function RegistrationScreen() {
  const { t, language } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length === 0) {
      setFieldError(t('registration.errors.nameRequired'));
      return;
    }
    setFieldError(null);
    setIsSubmitting(true);

    try {
      await register({
        fullName: trimmedName,
        mobileNumber: mobileNumber.trim() || undefined,
        preferredLanguage: language,
      });
      navigate(HOME_PATH, { replace: true });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : t('registration.errors.generic'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-2 py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-app-lg font-semibold text-text-primary">
          {t('registration.title')}
        </h1>
        <p className="mx-auto max-w-xs text-app-sm text-text-secondary">
          {t('registration.subtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs space-y-4"
        noValidate
      >
        <div className="space-y-1">
          <label
            htmlFor="registration-name"
            className="block text-app-sm font-medium text-text-secondary"
          >
            {t('registration.nameLabel')}
          </label>
          <input
            id="registration-name"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
            aria-invalid={fieldError !== null}
            aria-describedby={fieldError ? 'registration-name-error' : undefined}
          />
          {fieldError && (
            <p id="registration-name-error" role="alert" className="text-app-sm text-danger">
              {fieldError}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="registration-mobile"
            className="block text-app-sm font-medium text-text-secondary"
          >
            {t('registration.mobileLabel')}
          </label>
          <input
            id="registration-mobile"
            type="tel"
            autoComplete="tel"
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
            className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
          <p className="text-app-sm text-text-secondary">
            {t('registration.mobileHint')}
          </p>
        </div>

        <div className="space-y-1">
          <span className="block text-app-sm font-medium text-text-secondary">
            {t('registration.preferredLanguageLabel')}
          </span>
          <p className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark">
            {LANGUAGE_NATIVE_NAMES[language]}
          </p>
          <p className="text-app-sm text-text-secondary">
            {t('registration.preferredLanguageHint')}
          </p>
        </div>

        {submitError && (
          <p role="alert" className="text-app-sm text-danger">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-card bg-saffron px-6 py-3 text-app-base font-semibold text-white shadow-[var(--shadow-card)] disabled:opacity-60"
        >
          {isSubmitting ? t('common.loading') : t('registration.continue')}
        </button>
      </form>
    </div>
  );
}
