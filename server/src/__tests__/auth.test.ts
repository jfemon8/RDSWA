import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearTestDB } from './helpers/db';
import { createTestUser } from './helpers/auth';

// Mock email sending
jest.mock('../config/mail', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  transporter: { sendMail: jest.fn().mockResolvedValue(undefined) },
}));

// Mock Socket.IO and Web Push (not needed for auth tests)
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

describe('POST /api/auth/register', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.email).toBe('john@example.com');
    expect(res.body.data.role).toBe('user');
  });

  it('should reject duplicate email', async () => {
    await createTestUser({ email: 'duplicate@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another User',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bad Email',
        email: 'not-an-email',
        password: 'Password123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'No Password',
        email: 'no-pass@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  const userCredentials = {
    email: 'login-test@example.com',
    password: 'Password123!',
  };

  beforeEach(async () => {
    await createTestUser({
      ...userCredentials,
      name: 'Login Test User',
      isEmailVerified: true,
    });
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(userCredentials);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user.email).toBe(userCredentials.email);
  });

  it('should set refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(userCredentials);

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userCredentials.email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noone@example.com', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  it('should logout successfully', async () => {
    // First login
    await createTestUser({
      email: 'logout@example.com',
      password: 'Password123!',
      name: 'Logout User',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logout@example.com', password: 'Password123!' });

    const { accessToken } = loginRes.body.data;

    // Then logout
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/refresh-token', () => {
  it('should refresh access token', async () => {
    await createTestUser({
      email: 'refresh@example.com',
      password: 'Password123!',
      name: 'Refresh User',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'refresh@example.com', password: 'Password123!' });

    // Extract refresh token from cookie
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });
});
