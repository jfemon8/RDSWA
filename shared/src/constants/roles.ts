export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  MEMBER = 'member',
  ALUMNI = 'alumni',
  ADVISOR = 'advisor',
  SENIOR_ADVISOR = 'senior_advisor',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum CommitteePosition {
  PRESIDENT = 'president',
  VICE_PRESIDENT = 'vice_president',
  GENERAL_SECRETARY = 'general_secretary',
  JOINT_SECRETARY = 'joint_secretary',
  ORGANIZING_SECRETARY = 'organizing_secretary',
  TREASURER = 'treasurer',
  MEMBER = 'member',
}

/** Full role ordering including tag roles — used by RBAC middleware for legacy DB compat */
export const ROLE_HIERARCHY: UserRole[] = [
  UserRole.GUEST,
  UserRole.USER,
  UserRole.MEMBER,
  UserRole.ALUMNI,
  UserRole.ADVISOR,
  UserRole.SENIOR_ADVISOR,
  UserRole.MODERATOR,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

/**
 * Tier-only hierarchy (privilege levels). Alumni / Advisor / Senior Advisor
 * are orthogonal boolean tags, NOT privilege tiers — they don't appear here.
 * Use this for display, role hierarchy visualization, and tier comparisons.
 */
export const TIER_HIERARCHY: UserRole[] = [
  UserRole.GUEST,
  UserRole.USER,
  UserRole.MEMBER,
  UserRole.MODERATOR,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

/** Tag roles — orthogonal boolean flags, not privilege tiers */
export const TAG_ROLES: UserRole[] = [
  UserRole.ALUMNI,
  UserRole.ADVISOR,
  UserRole.SENIOR_ADVISOR,
];

/** Committee positions that auto-assign Admin role (current committee only) */
export const ADMIN_AUTO_POSITIONS: string[] = [
  CommitteePosition.PRESIDENT,
  CommitteePosition.GENERAL_SECRETARY,
];

/** Committee positions that auto-assign Moderator role (current committee only) */
export const MODERATOR_AUTO_POSITIONS: string[] = [
  CommitteePosition.ORGANIZING_SECRETARY,
  CommitteePosition.TREASURER,
];

/** All positions that receive any auto-role assignment */
export const ALL_AUTO_POSITIONS: string[] = [
  ...ADMIN_AUTO_POSITIONS,
  ...MODERATOR_AUTO_POSITIONS,
];

/** Hardcoded SuperAdmin emails */
export const SUPER_ADMIN_EMAILS: string[] = [
  'jfemon8@gmail.com',
  'emon.cse6.bu@gmail.com',
  'emon.onnorokom@gmail.com',
  'manikmia.phy@gmail.com',
];

/** SuperAdmins who cannot access the Backup page / backup routes */
export const BACKUP_RESTRICTED_SUPER_ADMINS: string[] = [
  'manikmia.phy@gmail.com',
];

/** SuperAdmins who cannot access the Settings page / settings routes */
export const SETTINGS_RESTRICTED_SUPER_ADMINS: string[] = [];
