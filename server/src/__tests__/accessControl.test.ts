import request from 'supertest';
import app from '../app';
import { Donation, Form, User } from '../models';
import { signAccessToken } from '../utils/token';
import { UserRole } from '@rdswa/shared';

const OWNER_ID = '6512c0a1b2c3d4e5f6a7b8c1';
const OTHER_ID = '6512c0a1b2c3d4e5f6a7b8c2';
const ADMIN_ID = '6512c0a1b2c3d4e5f6a7b8c3';
const DOC_ID = '6512c0a1b2c3d4e5f6a7b8c4';

const tokenFor = (id: string, role: UserRole) =>
  signAccessToken({ userId: id, email: `${id}@example.com`, role });

const actor = (id: string, role: UserRole, membershipStatus = 'approved') => ({
  _id: { toString: () => id },
  email: `${id}@example.com`,
  role,
  name: 'Actor',
  membershipStatus,
  isActive: true,
  isDeleted: false,
  isEmailVerified: true,
  save: jest.fn(),
});

const authAs = (id: string, role: UserRole, membershipStatus = 'approved') => {
  jest.spyOn(User, 'findById').mockReturnValue(actor(id, role, membershipStatus) as any);
  return `Bearer ${tokenFor(id, role)}`;
};

/** Stands in for the chained query each read builds. */
const query = (doc: any): any => {
  const q: any = {
    populate: () => q,
    select: () => q,
    lean: async () => doc,
    then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
  };
  return q;
};

afterEach(() => jest.restoreAllMocks());

describe('donation records', () => {
  const donation = () =>
    query({
      _id: DOC_ID,
      donor: { _id: { toString: () => OWNER_ID }, name: 'Donor' },
      visibility: 'public',
      paymentStatus: 'completed',
      donorEmail: 'donor@example.com',
      donorPhone: '01710000000',
      transactionId: 'TXN-1',
      toObject() {
        const { toObject, ...rest } = this as any;
        return rest;
      },
    });

  it('is closed to anonymous callers, who used to read contact and payment details', async () => {
    const res = await request(app).get(`/api/donations/${DOC_ID}`);
    expect(res.status).toBe(401);
  });

  it('is closed to another member', async () => {
    const auth = authAs(OTHER_ID, UserRole.MEMBER);
    jest.spyOn(Donation, 'findOne').mockReturnValue(donation());

    const res = await request(app).get(`/api/donations/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('opens to the donor', async () => {
    const auth = authAs(OWNER_ID, UserRole.MEMBER);
    jest.spyOn(Donation, 'findOne').mockReturnValue(donation());

    const res = await request(app).get(`/api/donations/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('opens to an Admin', async () => {
    const auth = authAs(ADMIN_ID, UserRole.ADMIN);
    jest.spyOn(Donation, 'findOne').mockReturnValue(donation());

    const res = await request(app).get(`/api/donations/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('keeps the receipt behind the same gate', async () => {
    const auth = authAs(OTHER_ID, UserRole.MEMBER);
    jest.spyOn(Donation, 'findOne').mockReturnValue(donation());

    const res = await request(app)
      .get(`/api/donations/${DOC_ID}/receipt`)
      .set('Authorization', auth);
    expect(res.status).toBe(403);
  });
});

describe('form submissions', () => {
  const form = () =>
    query({
      _id: DOC_ID,
      type: 'membership',
      submittedBy: { _id: { toString: () => OWNER_ID }, name: 'Applicant' },
      data: { reason: 'Please let me in' },
      attachments: [{ name: 'NID', url: 'https://example.com/nid.jpg' }],
    });

  it('is closed to another member, whose identity documents it would expose', async () => {
    const auth = authAs(OTHER_ID, UserRole.MEMBER);
    jest.spyOn(Form, 'findOne').mockReturnValue(form());

    const res = await request(app).get(`/api/forms/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('opens to the applicant', async () => {
    const auth = authAs(OWNER_ID, UserRole.MEMBER);
    jest.spyOn(Form, 'findOne').mockReturnValue(form());

    const res = await request(app).get(`/api/forms/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('opens to a reviewer', async () => {
    const auth = authAs(ADMIN_ID, UserRole.MODERATOR);
    jest.spyOn(Form, 'findOne').mockReturnValue(form());

    const res = await request(app).get(`/api/forms/${DOC_ID}`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });
});

describe('suspended accounts', () => {
  it('may still read', async () => {
    const auth = authAs(OWNER_ID, UserRole.MEMBER, 'suspended');
    const res = await request(app).get('/api/users/me').set('Authorization', auth);
    expect(res.status).not.toBe(403);
  });

  it('may not write, on a route that never reaches authorize()', async () => {
    const auth = authAs(OWNER_ID, UserRole.MEMBER, 'suspended');
    const res = await request(app)
      .post('/api/communication/groups/6512c0a1b2c3d4e5f6a7b8c9/messages')
      .set('Authorization', auth)
      .send({ content: 'hello' });
    expect(res.status).toBe(403);
  });

  it('may still log out', async () => {
    const auth = authAs(OWNER_ID, UserRole.MEMBER, 'suspended');
    const res = await request(app).post('/api/auth/logout').set('Authorization', auth);
    expect(res.status).not.toBe(403);
  });
});
