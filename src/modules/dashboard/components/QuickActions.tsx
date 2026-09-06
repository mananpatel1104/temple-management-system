import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import type { TranslationKey } from '@i18n/i18n.config';

interface QuickAction {
  labelKey: TranslationKey;
  /** Internal route, if that module's page already exists; undefined = not built yet. */
  path?: string;
  icon: 'library' | 'panchang' | 'gallery' | 'festival' | 'contact' | 'donation';
}

/**
 * Default Quick Actions in the fixed order specified by SRS 8.12: Library,
 * Panchang, Gallery, Festival Calendar, Contact Temple, QR Donation.
 * Library and Gallery already have real routes (Task 4); the other four
 * point at modules that don't exist yet, so those tiles render as
 * disabled with a "Soon" badge rather than linking to a route that isn't
 * really there (see Task 4/5 hand-off notes for what remains).
 */
const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'nav.library', path: '/library', icon: 'library' },
  { labelKey: 'dashboard.quickActions.panchang', icon: 'panchang' },
  { labelKey: 'nav.gallery', path: '/gallery', icon: 'gallery' },
  { labelKey: 'dashboard.quickActions.festivalCalendar', icon: 'festival' },
  { labelKey: 'dashboard.quickActions.contactTemple', icon: 'contact' },
  { labelKey: 'dashboard.quickActions.qrDonation', icon: 'donation' },
];

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function QuickActionIcon({ name }: { name: QuickAction['icon'] }) {
  switch (name) {
    case 'library':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20Z" />
        </svg>
      );
    case 'panchang':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'gallery':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 5-5 3.5 3.5L16 12l4 5" />
        </svg>
      );
    case 'festival':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 3v6" />
          <path d="M8 21h8l-1-8H9l-1 8Z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case 'contact':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M4 5h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 14l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 4 7a2 2 0 0 1 0-2Z" />
        </svg>
      );
    case 'donation':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <path d="M14 14h2.5M19.5 14H20M14 19.5V19M14 17h6M17.5 17v3" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Quick Actions grid (SRS 8.12). Elderly-friendly large touch targets
 * (UI-DASH-001), fixed order per spec.
 */
export function QuickActions() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section>
      <h2 className="mb-2 text-app-base font-semibold text-text-primary">
        {t('dashboard.quickActions.title')}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const enabled = Boolean(action.path);
          return (
            <button
              key={action.labelKey}
              type="button"
              disabled={!enabled}
              aria-disabled={!enabled}
              onClick={enabled ? () => navigate(action.path as string) : undefined}
              className={`relative flex flex-col items-center gap-1 rounded-card border border-black/10 bg-surface-light p-3 text-app-sm dark:border-white/10 dark:bg-surface-dark ${
                enabled ? 'text-text-primary' : 'text-text-secondary opacity-60'
              }`}
            >
              {!enabled ? (
                <span className="absolute right-1 top-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] leading-none text-text-secondary dark:bg-white/10">
                  {t('common.soon')}
                </span>
              ) : null}
              <QuickActionIcon name={action.icon} />
              <span className="text-center">{t(action.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
