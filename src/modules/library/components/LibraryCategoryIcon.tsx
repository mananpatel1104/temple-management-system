import type { LibraryCategoryIconName } from '@modules/library/types/library.types';

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Tiny hand-authored inline icon set for the Library Home Screen category
 * cards — deliberately not an icon library dependency, matching the same
 * bundle-size principle already used by BottomNavigationBar/QuickActions
 * (DP-007: usable on older/low-end Android devices).
 */
export function LibraryCategoryIcon({ name }: { name: LibraryCategoryIconName }) {
  switch (name) {
    case 'panchang':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'nirnay':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 3 4 7v2a8 8 0 0 0 8 12 8 8 0 0 0 8-12V7Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'aarti':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 3c1.5 2 1.5 3.5 0 5-1.5-1.5-1.5-3 0-5Z" />
          <path d="M7 21v-6a5 5 0 0 1 10 0v6" />
          <path d="M4 21h16" />
        </svg>
      );
    case 'nitya-niyam':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case 'kirtans':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      );
    case 'granths':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20Z" />
        </svg>
      );
    case 'stotra-prarthana':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5c2-.3 3.5.8 4 2 .5-1.2 2-2.3 4-2 3.5.5 5 4 3.5 7.5C19 16.65 12 21 12 21Z" />
        </svg>
      );
    case 'ram-krishna-govind':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H11v16H6.5A2.5 2.5 0 0 1 4 17.5Z" />
          <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H13v16h4.5a2.5 2.5 0 0 0 2.5-2.5Z" />
          <path d="M11 8h2M11 12h2" />
        </svg>
      );
    case 'janmangal':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M12 3v4M12 3c-1.4 1.3-1.4 2.7 0 4 1.4-1.3 1.4-2.7 0-4Z" />
          <circle cx="12" cy="14" r="7" />
          <path d="M9 14a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1-3 3" />
        </svg>
      );
    default:
      return null;
  }
}
