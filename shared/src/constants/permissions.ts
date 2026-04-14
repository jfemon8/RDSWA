import { UserRole } from './roles';

export enum Module {
  USERS = 'users',
  MEMBERS = 'members',
  COMMITTEES = 'committees',
  EVENTS = 'events',
  NOTICES = 'notices',
  DOCUMENTS = 'documents',
  GALLERY = 'gallery',
  DONATIONS = 'donations',
  EXPENSES = 'expenses',
  VOTES = 'votes',
  FORMS = 'forms',
  BUS_SCHEDULES = 'bus_schedules',
  NOTIFICATIONS = 'notifications',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  ADMIN = 'admin',
  COMMUNICATION = 'communication',
}

export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  EXPORT = 'export',
  MANAGE = 'manage',
}

type PermissionMap = Record<string, UserRole[]>;

/**
 * Maps "module:action" to the roles allowed.
 *
 * Moderator — basic CRUD, content moderation, user approval, reports viewing
 * Admin     — all Moderator + full management, finance, votes, bus, logs
 * SuperAdmin — all Admin + settings, admin management, backup, broadcast
 */
export const PERMISSIONS: PermissionMap = {
  // Users
  'users:read': [UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'users:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'users:approve': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'users:suspend': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'users:export': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Members
  'members:read': [UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Committees
  'committees:read': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'committees:create': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'committees:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'committees:delete': [UserRole.SUPER_ADMIN],

  // Events
  'events:read': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'events:create': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'events:update': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'events:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'events:manage': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Notices
  'notices:read': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'notices:create': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'notices:update': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'notices:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Documents
  'documents:read': [UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'documents:create': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'documents:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'documents:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Gallery
  'gallery:read': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'gallery:create': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'gallery:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'gallery:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Donations
  'donations:read': [UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'donations:create': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'donations:approve': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'donations:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Expenses
  'expenses:read': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'expenses:create': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'expenses:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'expenses:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Votes
  'votes:read': [UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'votes:create': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'votes:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Forms
  'forms:read': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'forms:create': [UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'forms:approve': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Bus Schedules
  'bus_schedules:read': [UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'bus_schedules:create': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'bus_schedules:update': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'bus_schedules:delete': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Notifications
  'notifications:create': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'notifications:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Reports
  'reports:read': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'reports:export': [UserRole.ADMIN, UserRole.SUPER_ADMIN],

  // Settings
  'settings:read': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'settings:update': [UserRole.SUPER_ADMIN],

  // Admin
  'admin:read': [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'admin:manage': [UserRole.ADMIN, UserRole.SUPER_ADMIN],
};
