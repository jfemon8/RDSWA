import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import { User, Vote } from '../models';
import { signAccessToken } from '../utils/token';
import { createVoteSchema, updateVoteSchema } from '../validators/vote.validator';
import { errorHandler } from '../middlewares/error.middleware';
import { UserRole } from '@rdswa/shared';

const VOTE_ID = '6512c0a1b2c3d4e5f6a7b8d1';
const VOTER_ID = '6512c0a1b2c3d4e5f6a7b8d2';
const BYSTANDER_ID = '6512c0a1b2c3d4e5f6a7b8d3';
const OPT_A = '6512c0a1b2c3d4e5f6a7b8da';
const OPT_B = '6512c0a1b2c3d4e5f6a7b8db';

const authAs = (id: string, role: UserRole) => {
  jest.spyOn(User, 'findById').mockReturnValue({
    _id: { toString: () => id },
    email: `${id}@example.com`,
    role,
    name: 'Actor',
    membershipStatus: 'approved',
    isActive: true,
    isDeleted: false,
    isEmailVerified: true,
    save: jest.fn(),
  } as any);
  return `Bearer ${signAccessToken({ userId: id, email: `${id}@example.com`, role })}`;
};

/** Stands in for the chained query each read builds. */
const query = (doc: any): any => {
  const q: any = {
    populate: () => q,
    select: () => q,
    sort: () => q,
    lean: async () => doc,
    then: (res: any, rej: any) => Promise.resolve(doc).then(res, rej),
  };
  return q;
};

const poll = (overrides: Record<string, unknown> = {}) => ({
  _id: VOTE_ID,
  title: 'Pick one',
  status: 'active',
  isResultPublic: false,
  totalVotes: 1,
  options: [
    { _id: OPT_A, text: 'A', voteCount: 1 },
    { _id: OPT_B, text: 'B', voteCount: 0 },
  ],
  voters: [{ user: { toString: () => VOTER_ID }, selectedOption: { toString: () => OPT_A }, skipped: false }],
  ...overrides,
});

afterEach(() => jest.restoreAllMocks());

describe('vote options validation', () => {
  const base = {
    title: 'Poll',
    startTime: '2026-11-20T00:00:00.000Z',
    endTime: '2026-11-21T00:00:00.000Z',
  };

  it('rejects a whitespace-only option', () => {
    expect(() => createVoteSchema.parse({ ...base, options: [{ text: 'A' }, { text: '   ' }] })).toThrow();
  });

  it('rejects options that differ only by case or spacing', () => {
    const options = [{ text: 'Same' }, { text: 'same ' }];
    expect(() => createVoteSchema.parse({ ...base, options })).toThrow('Options must be different');
    expect(() => updateVoteSchema.parse({ options })).toThrow('Options must be different');
  });

  it('stores trimmed text', () => {
    const parsed = createVoteSchema.parse({ ...base, title: '  Poll  ', options: [{ text: ' A ' }, { text: 'B' }] });
    expect(parsed.title).toBe('Poll');
    expect(parsed.options.map((o: { text: string }) => o.text)).toEqual(['A', 'B']);
  });
});

describe('malformed ids', () => {
  it('answers a CastError with 400, not 500', () => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id'), {} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Invalid ID format' }));
  });

  it('returns 400 when casting to a malformed poll id', async () => {
    const auth = authAs(VOTER_ID, UserRole.MEMBER);
    const res = await request(app)
      .post('/api/votes/not-an-id/cast')
      .set('Authorization', auth)
      .send({ optionId: OPT_A });
    expect(res.status).toBe(400);
  });
});

describe('who voted for what', () => {
  it('never reaches a member through the single-poll read', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.MEMBER);
    jest.spyOn(Vote, 'findOne').mockReturnValue(query(poll({ status: 'published', isResultPublic: true })));

    const res = await request(app).get(`/api/votes/${VOTE_ID}`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.voters).toBeUndefined();
    expect(res.body.data.options[0].voteCount).toBe(1);
  });

  it('keeps drafts out of a member read', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.MEMBER);
    const spy = jest.spyOn(Vote, 'findOne').mockReturnValue(query(null));

    await request(app).get(`/api/votes/${VOTE_ID}`).set('Authorization', auth);
    expect(spy.mock.calls[0][0]).toMatchObject({ status: { $ne: 'draft' } });
  });

  it('is hidden from an Admin in stats', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.ADMIN);
    jest.spyOn(Vote, 'findOne').mockReturnValue(query(poll({
      voters: [{ user: { name: 'Voter', batch: 10, role: 'member' }, selectedOption: { toString: () => OPT_A }, skipped: false }],
    })));

    const res = await request(app).get(`/api/votes/${VOTE_ID}/stats`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.voters[0].selectedOption).toBeUndefined();
  });

  it('is shown to SuperAdmin in stats', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.SUPER_ADMIN);
    jest.spyOn(Vote, 'findOne').mockReturnValue(query(poll({
      voters: [{ user: { name: 'Voter', batch: 10, role: 'member' }, selectedOption: { toString: () => OPT_A }, skipped: false }],
    })));

    const res = await request(app).get(`/api/votes/${VOTE_ID}/stats`).set('Authorization', auth);
    expect(res.body.data.voters[0].selectedOption).toBe('A');
  });
});

describe('tallies before results are published', () => {
  const closed = () => query(poll({ status: 'closed', isResultPublic: false }));

  it('are refused to a member who did not vote', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.MEMBER);
    jest.spyOn(Vote, 'findOne').mockReturnValue(closed());

    const res = await request(app).get(`/api/votes/${VOTE_ID}/results`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('are open to a member who voted, matching the live tallies they already saw', async () => {
    const auth = authAs(VOTER_ID, UserRole.MEMBER);
    jest.spyOn(Vote, 'findOne').mockReturnValue(closed());

    const res = await request(app).get(`/api/votes/${VOTE_ID}/results`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('are open to a moderator', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.MODERATOR);
    jest.spyOn(Vote, 'findOne').mockReturnValue(closed());

    const res = await request(app).get(`/api/votes/${VOTE_ID}/results`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('are stripped from the list for a member who did not vote', async () => {
    const auth = authAs(BYSTANDER_ID, UserRole.MEMBER);
    jest.spyOn(Vote, 'find').mockReturnValue(query([poll({ status: 'closed' })]) as any);

    const res = await request(app).get('/api/votes').set('Authorization', auth);
    const [item] = res.body.data;
    expect(item.voters).toBeUndefined();
    expect(item.totalVotes).toBeUndefined();
    expect(item.options[0].voteCount).toBeUndefined();
    expect(item.options[0].text).toBe('A');
  });

  it('stay in the list for a member who voted', async () => {
    const auth = authAs(VOTER_ID, UserRole.MEMBER);
    jest.spyOn(Vote, 'find').mockReturnValue(query([poll({ status: 'closed' })]) as any);

    const res = await request(app).get('/api/votes').set('Authorization', auth);
    expect(res.body.data[0].hasVoted).toBe(true);
    expect(res.body.data[0].options[0].voteCount).toBe(1);
  });
});
