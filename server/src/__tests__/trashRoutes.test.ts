import request from 'supertest';
import app from '../app';
import { Notice, User } from '../models';
import { signAccessToken } from '../utils/token';
import { UserRole } from '@rdswa/shared';

const SUPER_ID = '6512c0a1b2c3d4e5f6a7b8c9';
const ADMIN_ID = '6512c0a1b2c3d4e5f6a7b8ca';
const DOC_ID = '6512c0a1b2c3d4e5f6a7b8cb';

const tokenFor = (userId: string, role: UserRole) =>
  signAccessToken({ userId, email: `${role}@example.com`, role });

const authAs = (role: UserRole) => {
  const id = role === UserRole.SUPER_ADMIN ? SUPER_ID : ADMIN_ID;
  jest.spyOn(User, 'findById').mockReturnValue({
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
  } as any);
  return `Bearer ${tokenFor(id, role)}`;
};

afterEach(() => jest.restoreAllMocks());

describe('recycle bin access', () => {
  it('is closed to an Admin', async () => {
    const auth = authAs(UserRole.ADMIN);
    const res = await request(app).get('/api/trash').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('is closed to an unauthenticated caller', async () => {
    const res = await request(app).get('/api/trash');
    expect(res.status).toBe(401);
  });

  it('rejects a resource that is not in the registry', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    const res = await request(app).get('/api/trash/not-a-resource').set('Authorization', auth);
    expect(res.status).toBe(404);
  });

  it('rejects a sweep-only resource, which the bin does not list', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    const res = await request(app).get('/api/trash/messages').set('Authorization', auth);
    expect(res.status).toBe(404);
  });
});

describe('recycle bin actions', () => {
  it('restores only a record that is actually deleted', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    const findOneAndUpdate = jest
      .spyOn(Notice, 'findOneAndUpdate')
      .mockResolvedValue({ _id: DOC_ID } as any);

    const res = await request(app)
      .patch(`/api/trash/notices/${DOC_ID}/restore`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DOC_ID, isDeleted: true },
      { $set: { isDeleted: false } },
      { new: true },
    );
  });

  it('reports a miss when the record is not in the bin', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    jest.spyOn(Notice, 'findOneAndUpdate').mockResolvedValue(null as any);

    const res = await request(app)
      .patch(`/api/trash/notices/${DOC_ID}/restore`)
      .set('Authorization', auth);

    expect(res.status).toBe(404);
  });

  it('erases only a record that is actually deleted', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    const deleteOne = jest
      .spyOn(Notice, 'deleteOne')
      .mockResolvedValue({ deletedCount: 1 } as any);

    const res = await request(app)
      .delete(`/api/trash/notices/${DOC_ID}`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalledWith({ _id: DOC_ID, isDeleted: true });
  });

  it('will not erase a record that was never deleted', async () => {
    const auth = authAs(UserRole.SUPER_ADMIN);
    jest.spyOn(Notice, 'deleteOne').mockResolvedValue({ deletedCount: 0 } as any);

    const res = await request(app)
      .delete(`/api/trash/notices/${DOC_ID}`)
      .set('Authorization', auth);

    expect(res.status).toBe(404);
  });
});
