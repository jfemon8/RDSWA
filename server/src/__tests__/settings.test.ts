import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearTestDB } from './helpers/db';
import { createAdmin, createSuperAdmin, createAuthenticatedUser } from './helpers/auth';

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

describe('GET /api/settings', () => {
  it('should return public settings for unauthenticated users', async () => {
    const res = await request(app).get('/api/settings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should have public fields
    expect(res.body.data).toHaveProperty('siteName');
  });

  it('should return full settings for admin', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /api/settings', () => {
  it('should allow super admin to update settings', async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ siteName: 'Updated RDSWA' });

    expect(res.status).toBe(200);
    expect(res.body.data.siteName).toBe('Updated RDSWA');
  });

  it('should reject admin from updating site settings', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ siteName: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should reject regular user from updating settings', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ siteName: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/settings/about', () => {
  it('should allow admin to update about content', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .patch('/api/settings/about')
      .set('Authorization', `Bearer ${token}`)
      .send({
        aboutContent: 'New about content',
        missionContent: 'Our mission',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.aboutContent).toBe('New about content');
  });
});

describe('GET /api/settings/public-stats', () => {
  it('should return public statistics', async () => {
    const res = await request(app).get('/api/settings/public-stats');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalMembers');
    expect(res.body.data).toHaveProperty('totalEvents');
    expect(res.body.data).toHaveProperty('totalDistricts');
  });
});
