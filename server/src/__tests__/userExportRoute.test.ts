import request from 'supertest';
import app from '../app';
import { User } from '../models';
import { signAccessToken } from '../utils/token';
import { UserRole } from '@rdswa/shared';

/**
 * Proves the whole HTTP path: route, controller, service, builds the query each admin page expects,
 * with the model stubbed so no database is needed.
 */
const ADMIN_ID = '6512c0a1b2c3d4e5f6a7b8c9';

const token = signAccessToken({
  userId: ADMIN_ID,
  email: 'admin@example.com',
  role: UserRole.ADMIN,
});

let lastFilter: any;

beforeEach(() => {
  lastFilter = undefined;

  jest.spyOn(User, 'findById').mockReturnValue({
    _id: ADMIN_ID,
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    membershipStatus: 'approved',
    isActive: true,
    isDeleted: false,
    isModerator: true,
    isEmailVerified: true,
    save: jest.fn(),
  } as any);

  jest.spyOn(User, 'find').mockImplementation((filter?: any) => {
    lastFilter = filter;
    return {
      select: () => ({ sort: () => ({ lean: async () => [] }) }),
    } as any;
  });
});

afterEach(() => jest.restoreAllMocks());

const exportWith = async (query: string) => {
  const res = await request(app)
    .get(`/api/users/export/directory?${query}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return lastFilter;
};

describe('GET /api/users/export/directory', () => {
  it('puts no membership condition on an unfiltered users export', async () => {
    const filter = await exportWith('format=csv');
    expect(filter).toEqual({ isDeleted: { $ne: true } });
    expect(filter).not.toHaveProperty('membershipStatus');
  });

  it('exports one membership status when the users page filters by it', async () => {
    for (const status of ['pending', 'rejected', 'suspended', 'none']) {
      const filter = await exportWith(`format=csv&membershipStatus=${status}`);
      expect(filter.membershipStatus).toBe(status);
    }
  });

  it('exports only approved members for the members page', async () => {
    const filter = await exportWith('format=csv&membershipStatus=approved');
    expect(filter).toEqual({ isDeleted: { $ne: true }, membershipStatus: 'approved' });
  });

  it('carries the members page batch and department filters through', async () => {
    const filter = await exportWith(
      'format=csv&membershipStatus=approved&batch=2019&department=CSE',
    );
    expect(filter).toMatchObject({ batch: 2019, department: 'CSE' });
  });

  it('ignores pagination, so the export is never one page of the listing', async () => {
    const filter = await exportWith('format=csv&page=2&limit=20');
    expect(filter).toEqual({ isDeleted: { $ne: true } });
  });

  it('refuses to widen to deleted users for an admin, which is a SuperAdmin listing', async () => {
    const filter = await exportWith('format=csv&includeDeleted=true');
    expect(filter).toEqual({ isDeleted: { $ne: true } });
  });
});
