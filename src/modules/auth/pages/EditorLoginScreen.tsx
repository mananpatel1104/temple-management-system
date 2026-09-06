import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import { useAuth } from '@modules/auth/context/AuthContext';
import { HOME_PATH } from '@app/router/routes.config';
import { ApiError } from '@shared/lib/functionsClient';

/**
 * Editor Login Screen (FR-AUTH-006): "Fields — Name, PIN. Buttons —
 * Login, Cancel." FR-AUTH-008/009 incorrect-PIN and lockout messages are
 * shown verbatim from the Edge Function's response, since auth-login
 * already produces the exact copy the SRS specifies.
 */
export function EditorLoginScreen() {
  const { t } = useLanguage();
  const { loginEditor } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await loginEditor({ fullName: fullName.trim(), pin });
      navigate(HOME_PATH, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-2 py-8">
      <h1 className="text-app-lg font-semibold text-text-primary">{t('auth.editorLoginTitle')}</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="editor-login-name" className="block text-app-sm font-medium text-text-secondary">
            {t('registration.nameLabel')}
          </label>
          <input
            id="editor-login-name"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-app-base text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="editor-login-pin" className="block text-app-sm font-medium text-text-secondary">
            {t('auth.pinLabel')}
          </label>
          <input
            id="editor-login-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-card border border-black/10 bg-surface-light px-4 py-3 text-center text-app-lg tracking-[0.5em] text-text-primary dark:border-white/10 dark:bg-surface-dark"
          />
        </div>

        {errorMessage && (
          <p role="alert" className="text-app-sm text-danger">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(HOME_PATH)}
            className="flex-1 rounded-card border border-black/10 px-4 py-3 text-app-base text-text-secondary dark:border-white/10"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={fullName.trim().length === 0 || pin.length < 4 || isSubmitting}
            className="flex-1 rounded-card bg-saffron px-4 py-3 text-app-base font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? t('common.loading') : t('auth.login')}
          </button>
        </div>
      </form>
    </section>
  );
}
