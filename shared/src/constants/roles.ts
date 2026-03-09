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

/** Roles ordered by privilege level (higher index = more privilege) */
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

/** Committee positions that auto-assign Moderator role */
export const MODERATOR_AUTO_POSITIONS: string[] = [
  CommitteePosition.PRESIDENT,
  CommitteePosition.GENERAL_SECRETARY,
  CommitteePosition.ORGANIZING_SECRETARY,
  CommitteePosition.TREASURER,
];

/** Positions that retain Moderator after committee archive */
export const MODERATOR_RETAIN_POSITIONS: string[] = [
  CommitteePosition.PRESIDENT,
  CommitteePosition.GENERAL_SECRETARY,
];

/** Hardcoded SuperAdmin emails */
export const SUPER_ADMIN_EMAILS: string[] = [
  'jfemon8@gmail.com',
  'emon.cse6.bu@gmail.com',
  'emon.onnorokom@gmail.com',
];
