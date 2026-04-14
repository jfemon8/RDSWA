import { UserRole, ROLE_HIERARCHY, TIER_HIERARCHY } from '@rdswa/shared';

/** Role display config: label, color classes */
const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  [UserRole.SUPER_ADMIN]: { label: 'Super Admin', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  [UserRole.ADMIN]: { label: 'Admin', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  [UserRole.MODERATOR]: { label: 'Moderator', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  [UserRole.SENIOR_ADVISOR]: { label: 'Senior Advisor', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  [UserRole.ADVISOR]: { label: 'Advisor', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  [UserRole.ALUMNI]: { label: 'Alumni', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  [UserRole.MEMBER]: { label: 'Member', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  [UserRole.USER]: { label: 'User', bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' },
  [UserRole.GUEST]: { label: 'Guest', bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-500 dark:text-gray-400' },
};

export function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] || { label: role.replace('_', ' '), bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' };
}

/** Get the highest (primary) role label */
export function getPrimaryRoleLabel(role: string): string {
  return getRoleConfig(role).label;
}

/**
 * Get all effective tier-level roles for a user based on hierarchy.
 * A SuperAdmin effectively holds all lower tiers; an Admin holds admin, moderator, member.
 * Skips guest/user for anyone member+. Excludes tag roles (alumni/advisor/senior_advisor)
 * — those render separately from the persisted isAlumni/isAdvisor/isSeniorAdvisor flags.
 */
export function getEffectiveRoles(role: string): string[] {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  if (idx < 0) return [role];

  // Only include tier roles at or below the user's hierarchy level
  const effective = TIER_HIERARCHY.filter(
    (r) => ROLE_HIERARCHY.indexOf(r) <= idx
  ).reverse();

  // Skip guest and user for anyone who is member+
  if (idx >= ROLE_HIERARCHY.indexOf(UserRole.MEMBER)) {
    return effective.filter((r) => r !== UserRole.GUEST && r !== UserRole.USER);
  }

  return effective;
}

/** Check if a role meets or exceeds a minimum role */
export function hasMinRole(userRole: string, minRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole as UserRole) >= ROLE_HIERARCHY.indexOf(minRole);
}
