import { User } from '../../models';
import { signAccessToken } from '../../utils/token';
import { UserRole } from '@rdswa/shared';

interface CreateUserOptions {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  membershipStatus?: string;
}

export async function createTestUser(options: CreateUserOptions = {}) {
  const user = await User.create({
    name: options.name || 'Test User',
    email: options.email || `test-${Date.now()}@example.com`,
    password: options.password || 'Password123!',
    role: options.role || UserRole.USER,
    isEmailVerified: options.isEmailVerified ?? true,
    membershipStatus: options.membershipStatus || 'none',
  });
  return user;
}

export async function createAuthenticatedUser(options: CreateUserOptions = {}) {
  const user = await createTestUser(options);
  const token = signAccessToken({
    userId: (user._id as any).toString(),
    email: user.email,
    role: user.role,
  });
  return { user, token };
}

export async function createAdmin() {
  return createAuthenticatedUser({ role: UserRole.ADMIN, name: 'Admin User' });
}

export async function createSuperAdmin() {
  return createAuthenticatedUser({ role: UserRole.SUPER_ADMIN, name: 'Super Admin' });
}

export async function createMember() {
  return createAuthenticatedUser({
    role: UserRole.MEMBER,
    name: 'Member User',
    membershipStatus: 'approved',
  });
}

export async function createModerator() {
  return createAuthenticatedUser({ role: UserRole.MODERATOR, name: 'Moderator User' });
}
