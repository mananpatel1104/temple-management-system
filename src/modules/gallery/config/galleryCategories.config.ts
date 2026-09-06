import type { TranslationKey } from '@i18n/i18n.config';
import type { AlbumType } from '../types/gallery.types';

export interface GalleryCategoryConfig {
  id: AlbumType;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: AlbumType;
}

/**
 * Gallery Home Screen categories (SRS 11.3/FR-GAL-001), in the fixed
 * order given by the SRS: Daily Darshan, Festival Albums, Sabha Albums,
 * Special Events. "Videos (Optional)" is intentionally omitted — see
 * gallery.types.ts.
 *
 * Single source of truth this screen renders from, mirroring the
 * pattern already established by
 * src/modules/library/config/libraryCategories.config.ts.
 */
export const GALLERY_CATEGORIES: GalleryCategoryConfig[] = [
  {
    id: 'daily_darshan',
    titleKey: 'gallery.categories.dailyDarshan.title',
    descriptionKey: 'gallery.categories.dailyDarshan.description',
    icon: 'daily_darshan',
  },
  {
    id: 'festival',
    titleKey: 'gallery.categories.festival.title',
    descriptionKey: 'gallery.categories.festival.description',
    icon: 'festival',
  },
  {
    id: 'sabha',
    titleKey: 'gallery.categories.sabha.title',
    descriptionKey: 'gallery.categories.sabha.description',
    icon: 'sabha',
  },
  {
    id: 'event',
    titleKey: 'gallery.categories.event.title',
    descriptionKey: 'gallery.categories.event.description',
    icon: 'event',
  },
];
