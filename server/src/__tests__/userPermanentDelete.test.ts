import request from 'supertest';
import app from '../app';
import { User } from '../models';
import { signAccessToken } from '../utils/token';
import { UserRole } from '@rdswa/shared';

const SUPER_ID = '6512c0a1b2c3d4e5f6a7b8c9';
const ADMIN_ID = '6512c0a1b2c3d4e5f6a7b8ca';
const TARGET_ID = '6512c0a1b2c3d4e5f6a7b8cb';

const tokenFor = (userId: string, role: UserRole) =>
  signAccessToken({ userId, email: `${role}@example.com`, role });

const actor = (id: string, role: UserRole) => ({
  _id: id,
  email: `${role}@example.com`,
  role,
  name: 'Actor',
  membershipStatus: 'approved',
  isActive: true,
  isDeleted: false,
  isModerator: true,
  isEmailVerified: true,
  save: jest.fn(),
});

/** Stands in for a Mongoose query, which is awaited directly in one place and `.select()`-ed in another. */
const query = (doc: any) => {
  const q: any = {
    select: () => q,
    then: (resolve: any, reject: any) => Promise.resolve(doc).then(resolve, reject),
  };
  return q;
};

let deleteOne: jest.SpyInstance;

const mockUsers = (target: any, actingRole = UserRole.SUPER_ADMIN) => {
  const actingId = actingRole === UserRole.SUPER_ADMIN ? SUPER_ID : ADMIN_ID;
  jest
    .spyOn(User, 'findById')
    .mockImplementation((id: any) =>
      query(String(id) === actingId ? actor(actingId, actingRole) : target),
    );
  deleteOne = jest.spyOn(User, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);
};

afterEach(() => jest.restoreAllMocks());

describe('DELETE /api/users/:id/permanent', () => {
  it('erases an account that is already soft-deleted', async () => {
    mockUsers({ _id: TARGET_ID, role: UserRole.MEMBER, isDeleted: true });

    const res = await request(app)
      .delete(`/api/users/${TARGET_ID}/permanent`)
      .set('Authorization', `Bearer ${tokenFor(SUPER_ID, UserRole.SUPER_ADMIN)}`);

    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalledWith({ _id: TARGET_ID });
  });

  it('refuses an account that has not been deleted yet', async () => {
    mockUsers({ _id: TARGET_ID, role: UserRole.MEMBER, isDeleted: false });

    const res = await request(app)
      .delete(`/api/users/${TARGET_ID}/permanent`)
      .set('Authorization', `Bearer ${tokenFor(SUPER_ID, UserRole.SUPER_ADMIN)}`);

    expect(res.status).toBe(400);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('refuses to erase a SuperAdmin', async () => {
    mockUsers({ _id: TARGET_ID, role: UserRole.SUPER_ADMIN, isDeleted: true });

    const res = await request(app)
      .delete(`/api/users/${TARGET_ID}/permanent`)
      .set('Authorization', `Bearer ${tokenFor(SUPER_ID, UserRole.SUPER_ADMIN)}`);

    expect(res.status).toBe(403);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('is closed to an Admin', async () => {
    mockUsers({ _id: TARGET_ID, role: UserRole.MEMBER, isDeleted: true }, UserRole.ADMIN);

    const res = await request(app)
      .delete(`/api/users/${TARGET_ID}/permanent`)
      .set('Authorization', `Bearer ${tokenFor(ADMIN_ID, UserRole.ADMIN)}`);

    expect(res.status).toBe(403);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('is closed to an unauthenticated caller', async () => {
    mockUsers({ _id: TARGET_ID, role: UserRole.MEMBER, isDeleted: true });

    const res = await request(app).delete(`/api/users/${TARGET_ID}/permanent`);

    expect(res.status).toBe(401);
    expect(deleteOne).not.toHaveBeenCalled();
  });
});
