import { useLanguage } from '@app/providers/LanguageProvider';

interface WelcomeHeaderProps {
  /**
   * The devotee's registered name (FR-DASH-001: "Jay Swaminarayan,
   * Manan"). Undefined for now — devotee registration (Auth module,
   * FR-AUTH-003+) is not implemented yet, so the header falls back to the
   * greeting alone rather than inventing a name.
   */
  registeredName?: string;
}

/**
 * Welcome Header (SRS 8.4, FR-DASH-001). Temple Logo + Temple Name +
 * personalized greeting.
 *
 * FR-DASH-002's special-day themed banner (Ekadashi/Poonam/Amavasya/major
 * festivals) depends on Panchang data that isn't available yet (no
 * Panchang data service exists — see PanchangCard), so this always
 * renders the standard dashboard theme for now, matching the SRS's own
 * "on normal days, the standard dashboard theme shall be displayed"
 * fallback.
 */
export function WelcomeHeader({ registeredName }: WelcomeHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="flex items-center gap-3 rounded-card bg-cream/60 p-4 dark:bg-surface-dark">
      <img
        src={`${import.meta.env.BASE_URL}icons/temple-logo.png`}
        alt={t('app.name')}
        className="h-14 w-14 rounded-full object-cover shadow-[var(--shadow-card)]"
      />
      <div className="min-w-0">
        <p className="truncate text-app-lg font-semibold text-text-primary">
          {t('app.name')}
        </p>
        <p className="truncate text-app-base text-saffron">
          {registeredName ? `${t('app.greeting')}, ${registeredName}` : t('app.greeting')}
        </p>
      </div>
    </header>
  );
}
