import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearTestDB } from './helpers/db';
import {
  createAuthenticatedUser,
  createAdmin,
  createModerator,
  createMember,
} from './helpers/auth';
import { UserRole } from '@rdswa/shared';

// Mock email sending
jest.mock('../config/mail', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  transporter: { sendMail: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../socket', () => ({ initSocket: jest.fn(), getIO: jest.fn().mockReturnValue(null) }));
jest.mock('../config/webpush', () => ({ initWebPush: jest.fn(), sendPushNotification: jest.fn().mockResolvedValue(undefined) }));

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe('GET /api/users/me', () => {
  it('should return current user profile', async () => {
    const { token } = await createAuthenticatedUser({ name: 'My Profile' });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('My Profile');
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('should update own profile', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', phone: '01700000000' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });
});

describe('GET /api/users', () => {
  it('should allow admin to list all users', async () => {
    const { token } = await createAdmin();
    await createAuthenticatedUser({ name: 'User 1' });
    await createAuthenticatedUser({ name: 'User 2' });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject non-admin users', async () => {
    const { token } = await createMember();

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/approve', () => {
  it('should allow moderator to approve membership', async () => {
    const { token } = await createModerator();
    const { user: pendingUser } = await createAuthenticatedUser({
      membershipStatus: 'pending',
    });

    const res = await request(app)
      .patch(`/api/users/${pendingUser._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.membershipStatus).toBe('approved');
  });

  it('should reject regular user from approving', async () => {
    const { token } = await createAuthenticatedUser();
    const { user: pendingUser } = await createAuthenticatedUser({
      membershipStatus: 'pending',
    });

    const res = await request(app)
      .patch(`/api/users/${pendingUser._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('should allow admin to change user role', async () => {
    const { token } = await createAdmin();
    const { user } = await createAuthenticatedUser();

    const res = await request(app)
      .patch(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: UserRole.MEMBER });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe(UserRole.MEMBER);
  });

  it('should reject non-admin from changing roles', async () => {
    const { token } = await createMember();
    const { user } = await createAuthenticatedUser();

    const res = await request(app)
      .patch(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: UserRole.ADMIN });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/suspend', () => {
  it('should allow admin to suspend a user', async () => {
    const { token } = await createAdmin();
    const { user } = await createAuthenticatedUser();

    const res = await request(app)
      .patch(`/api/users/${user._id}/suspend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Violation of rules' });

    expect(res.status).toBe(200);
    expect(res.body.data.membershipStatus).toBe('suspended');
  });
});

describe('GET /api/users/:id', () => {
  it('should get user by ID', async () => {
    const { token } = await createAuthenticatedUser();
    const { user: targetUser } = await createAuthenticatedUser({ name: 'Target' });

    const res = await request(app)
      .get(`/api/users/${targetUser._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Target');
  });
});
