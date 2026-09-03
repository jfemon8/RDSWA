import { UserRole } from '@rdswa/shared';
import { IUserDocument } from '../models';

/** The tier a user falls back to when Moderator or Admin is removed, which is MEMBER for an approved member and USER otherwise. */
export function resolveBaseRole(user: IUserDocument): UserRole {
  if (user.membershipStatus === 'approved') return UserRole.MEMBER;
  return UserRole.USER;
}
