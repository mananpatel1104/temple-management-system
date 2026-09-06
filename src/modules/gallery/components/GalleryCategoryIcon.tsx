import type { AlbumType } from '../types/gallery.types';

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
 * Tiny hand-authored inline icon set for the Gallery Home Screen
 * category cards — matching the same no-icon-library principle already
 * used by LibraryCategoryIcon/BottomNavigationBar (DP-007).
 */
export function GalleryCategoryIcon({ name }: { name: AlbumType }) {
  switch (name) {
    case 'daily_darshan':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
    case 'festival':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <path d="M4 21V11l8-6 8 6v10" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    case 'sabha':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3 20c0-2.8 2.2-5 5-5s5 2.2 5 5M11 20c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        </svg>
      );
    case 'event':
      return (
        <svg {...ICON_PROPS} aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      );
    default:
      return null;
  }
}
