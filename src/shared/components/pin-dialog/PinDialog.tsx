import { useState, type FormEvent } from 'react';
import { useLanguage } from '@app/providers/LanguageProvider';

/**
 * PinDialog (SDD 8.1 App Shell -> "PinDialog (overlay, invoked by any
 * protected action)"; SDD 8.2 Shared UI Components — "Any editor action
 * across all modules"). A controlled, presentation-only component: the
 * caller supplies onSubmit and any async/loading/error state.
 */
export interface PinDialogProps {
  title: string;
  onSubmit: (pin: string) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export function PinDialog({ title, onSubmit, onCancel, isSubmitting, errorMessage }: PinDialogProps) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(pin);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-card bg-surface-light p-6 shadow-[var(--shadow-card-elevated)] dark:bg-surface-dark"
      >
        <h2 className="mb-4 text-center text-app-lg font-semibold text-text-primary">
          {title}
        </h2>

        <label htmlFor="pin-dialog-input" className="sr-only">
          {t('auth.pinLabel')}
        </label>
        <input
          id="pin-dialog-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="mb-3 w-full rounded-card border border-black/10 bg-transparent px-4 py-3 text-center text-app-lg tracking-[0.5em] text-text-primary dark:border-white/10"
        />

        {errorMessage && (
          <p role="alert" className="mb-3 text-center text-app-sm text-danger">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-card border border-black/10 px-4 py-3 text-app-base text-text-secondary dark:border-white/10"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pin.length < 4 || isSubmitting}
            className="flex-1 rounded-card bg-saffron px-4 py-3 text-app-base font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? t('common.loading') : t('auth.login')}
          </button>
        </div>
      </form>
    </div>
  );
}
