import request from 'supertest';
import app from '../app';
import { connectTestDB, disconnectTestDB, clearTestDB } from './helpers/db';
import {
  createAdmin,
  createMember,
  createAuthenticatedUser,
} from './helpers/auth';

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

describe('GET /api/committees', () => {
  it('should list committees (public)', async () => {
    const res = await request(app).get('/api/committees');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/committees', () => {
  it('should allow admin to create committee', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .post('/api/committees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '1st Committee',
        tenure: {
          startDate: '2025-01-01',
        },
        isCurrent: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('1st Committee');
    expect(res.body.data.isCurrent).toBe(true);
  });

  it('should reject non-admin from creating committee', async () => {
    const { token } = await createMember();

    const res = await request(app)
      .post('/api/committees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '1st Committee',
        tenure: { startDate: '2025-01-01' },
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/committees/:id/members', () => {
  it('should add member to committee', async () => {
    const { token } = await createAdmin();
    const { user: member } = await createMember();

    // Create committee first
    const committeeRes = await request(app)
      .post('/api/committees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '2nd Committee',
        tenure: { startDate: '2025-06-01' },
      });

    const committeeId = committeeRes.body.data._id;

    // Add member
    const res = await request(app)
      .post(`/api/committees/${committeeId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        user: member._id.toString(),
        position: 'member',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(1);
  });
});

describe('PATCH /api/committees/:id', () => {
  it('should update committee details', async () => {
    const { token } = await createAdmin();

    const createRes = await request(app)
      .post('/api/committees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Old Name',
        tenure: { startDate: '2025-01-01' },
      });

    const committeeId = createRes.body.data._id;

    const res = await request(app)
      .patch(`/api/committees/${committeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name', description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });
});

describe('GET /api/committees/:id', () => {
  it('should get committee by ID', async () => {
    const { token } = await createAdmin();

    const createRes = await request(app)
      .post('/api/committees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Specific Committee',
        tenure: { startDate: '2025-01-01' },
      });

    const committeeId = createRes.body.data._id;

    const res = await request(app).get(`/api/committees/${committeeId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Specific Committee');
  });
});
