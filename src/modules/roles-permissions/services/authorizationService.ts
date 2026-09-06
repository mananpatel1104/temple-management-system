import type { ModuleKey, RoleKey } from '../types/roles.types';
import { can as canFromMatrix } from '../config/permissionMatrix';

/**
 * AuthorizationService (SDD 4.2). Thin wrapper kept as its own module so
 * components depend on a stable service name rather than reaching into
 * the matrix config directly — matches the SDD's named component and
 * gives one place to add e.g. logging/telemetry later without touching
 * every call site.
 */
export const authorizationService = {
  can(role: RoleKey | undefined | null, moduleKey: ModuleKey, action: string): boolean {
    return canFromMatrix(role, moduleKey, action);
  },
};
