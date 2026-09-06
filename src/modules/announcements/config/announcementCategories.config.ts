import type { TranslationKey } from '@i18n/i18n.config';
import type { AnnouncementCategory } from '../types/announcement.types';

export interface AnnouncementCategoryConfig {
  id: AnnouncementCategory;
  labelKey: TranslationKey;
  /** The PermissionMatrix `announcements` action that gates CREATING this category (SRS 12.6/BR-014). */
  createAction: string;
}

/**
 * SRS 12.3 category list, in SRS order. Single source of truth for the
 * category filter chips, the create-form category picker (filtered by
 * what the current role may create, via createAction +
 * authorizationService.can), and the category badge labels.
 */
export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategoryConfig[] = [
  { id: 'general', labelKey: 'announcements.categories.general', createAction: 'create_general' },
  { id: 'festival', labelKey: 'announcements.categories.festival', createAction: 'create_festival' },
  { id: 'mens', labelKey: 'announcements.categories.mens', createAction: 'create_mens' },
  { id: 'ladies', labelKey: 'announcements.categories.ladies', createAction: 'create_ladies' },
  { id: 'volunteer', labelKey: 'announcements.categories.volunteer', createAction: 'create_volunteer' },
  { id: 'emergency', labelKey: 'announcements.categories.emergency', createAction: 'create_emergency' },
];

export const ANNOUNCEMENT_PRIORITY_LABEL_KEYS: Record<'high' | 'medium' | 'low', TranslationKey> = {
  high: 'announcements.priorities.high',
  medium: 'announcements.priorities.medium',
  low: 'announcements.priorities.low',
};
