import { functionsClient } from '@shared/lib/functionsClient';
import type { RoleKey } from '@modules/roles-permissions/types/roles.types';
import type { AccountStatus, MemberDetail, MemberListItem } from '../types/member.types';

/**
 * MemberController-equivalent client service (SDD 4.8). Every method
 * requires the caller to already hold a valid editor session token
 * (Supreme Administrator, per the permission matrix) — the token itself
 * is what gets the request past the Edge Function's requirePermission()
 * check; there is no client-side gate here beyond that.
 */
export const memberService = {
  async search(
    sessionToken: string,
    params: { query?: string; role?: RoleKey; status?: AccountStatus; limit?: number; offset?: number } = {},
  ): Promise<{ members: MemberListItem[]; total: number }> {
    return functionsClient.post<{ members: MemberListItem[]; total: number }>(
      'member-management',
      { action: 'list', ...params },
      sessionToken,
    );
  },

  async get(sessionToken: string, memberId: string): Promise<MemberDetail> {
    return functionsClient.post<MemberDetail>('member-management', { action: 'get', memberId }, sessionToken);
  },

  async changeRole(
    sessionToken: string,
    memberId: string,
    newRoleKey: RoleKey,
  ): Promise<{ member_id: string; role: RoleKey; pin_required: boolean }> {
    return functionsClient.post<{ member_id: string; role: RoleKey; pin_required: boolean }>(
      'member-management',
      { action: 'changeRole', memberId, newRoleKey },
      sessionToken,
    );
  },

  async setStatus(sessionToken: string, memberId: string, status: AccountStatus): Promise<void> {
    await functionsClient.post('member-management', { action: 'setStatus', memberId, status }, sessionToken);
  },

  async updateNotes(sessionToken: string, memberId: string, notes: string): Promise<void> {
    await functionsClient.post('member-management', { action: 'updateNotes', memberId, notes }, sessionToken);
  },

  async deleteMember(sessionToken: string, memberId: string): Promise<void> {
    await functionsClient.post('member-management', { action: 'deleteMember', memberId }, sessionToken);
  },

  async resetPin(sessionToken: string, memberId: string, newPin: string): Promise<void> {
    await functionsClient.put('auth-reset-pin', { memberId, newPin }, sessionToken);
  },
};
