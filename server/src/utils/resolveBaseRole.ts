import { UserRole } from '@rdswa/shared';
import { IUserDocument } from '../models';

/**
 * Determine the privilege tier a user should fall back to
 * when the Moderator or Admin role is removed.
 *
 * Alumni / Advisor / Senior Advisor are now tags (booleans), not tiers —
 * they don't affect the base privilege level. The base role is simply:
 *   approved member → MEMBER, otherwise USER.
 */
export function resolveBaseRole(user: IUserDocument): UserRole {
  if (user.membershipStatus === 'approved') return UserRole.MEMBER;
  return UserRole.USER;
}
