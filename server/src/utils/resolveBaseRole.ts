import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';
import { IUserDocument } from '../models';

/**
 * Determine the highest non-privileged role a user should fall back to
 * when Moderator or Admin role is removed.
 *
 * Priority: current role if below moderator > ALUMNI (if qualifies) > MEMBER (if approved) > USER
 */
export function resolveBaseRole(user: IUserDocument): UserRole {
  const currentIdx = ROLE_HIERARCHY.indexOf(user.role as UserRole);
  const moderatorIdx = ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);

  // If user already holds a role below Moderator (e.g. Advisor, Senior Advisor), keep it
  if (currentIdx < moderatorIdx && currentIdx > ROLE_HIERARCHY.indexOf(UserRole.USER)) {
    return user.role as UserRole;
  }

  // Check alumni status (virtual field)
  if (user.isAlumni) return UserRole.ALUMNI;

  // Check membership
  if (user.membershipStatus === 'approved') return UserRole.MEMBER;

  return UserRole.USER;
}
