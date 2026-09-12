import request from 'supertest';
import app from '../app';
import { ChatGroup, Message, User } from '../models';
import { signAccessToken } from '../utils/token';
import { UserRole } from '@rdswa/shared';

const USER_ID = '6512c0a1b2c3d4e5f6a7b8c9';
const GROUP_ID = '6512c0a1b2c3d4e5f6a7b8ca';
const MESSAGE_ID = '6512c0a1b2c3d4e5f6a7b8cb';

const token = signAccessToken({
  userId: USER_ID,
  email: 'member@example.com',
  role: UserRole.MEMBER,
});

/** A message stub carrying the reactions the handler reads, saves and populates. */
const messageWith = (reactions: Array<{ user: string; emoji: string }>) => ({
  _id: MESSAGE_ID,
  reactions: reactions.map((r) => ({ ...r, user: { toString: () => r.user } })),
  save: jest.fn(),
  populate: jest.fn(),
});

const react = (emoji: string | null) =>
  request(app)
    .post(`/api/communication/groups/${GROUP_ID}/messages/${MESSAGE_ID}/react`)
    .set('Authorization', `Bearer ${token}`)
    .send({ emoji });

beforeEach(() => {
  jest.spyOn(User, 'findById').mockReturnValue({
    _id: { toString: () => USER_ID },
    email: 'member@example.com',
    role: UserRole.MEMBER,
    membershipStatus: 'approved',
    isActive: true,
    isDeleted: false,
    isEmailVerified: true,
    save: jest.fn(),
  } as any);
  jest
    .spyOn(ChatGroup, 'findOne')
    .mockReturnValue({ select: async () => ({ _id: GROUP_ID }) } as any);
});

afterEach(() => jest.restoreAllMocks());

describe('reacting to a group message', () => {
  it('adds a reaction from the supported set', async () => {
    const message = messageWith([]);
    jest.spyOn(Message, 'findOne').mockResolvedValue(message as any);

    const res = await react('👍');

    expect(res.status).toBe(200);
    expect(message.reactions).toHaveLength(1);
  });

  it('rejects an emoji outside the supported set', async () => {
    jest.spyOn(Message, 'findOne').mockResolvedValue(messageWith([]) as any);

    const res = await react('🦄');

    expect(res.status).toBe(400);
  });

  it('takes back a reaction stored by name from the announcement channel', async () => {
    // The same messages carry named reactions, which used to be impossible to undo from the chat.
    const message = messageWith([{ user: USER_ID, emoji: 'like' }]);
    jest.spyOn(Message, 'findOne').mockResolvedValue(message as any);

    const res = await react('like');

    expect(res.status).toBe(200);
    expect(message.reactions).toHaveLength(0);
  });

  it('toggles off a supported reaction the user already left', async () => {
    const message = messageWith([{ user: USER_ID, emoji: '❤️' }]);
    jest.spyOn(Message, 'findOne').mockResolvedValue(message as any);

    const res = await react('❤️');

    expect(res.status).toBe(200);
    expect(message.reactions).toHaveLength(0);
  });

  it('clears the reaction when none is given', async () => {
    const message = messageWith([{ user: USER_ID, emoji: 'like' }]);
    jest.spyOn(Message, 'findOne').mockResolvedValue(message as any);

    const res = await react(null);

    expect(res.status).toBe(200);
    expect(message.reactions).toHaveLength(0);
  });

  it('will not adopt an unsupported reaction left by someone else', async () => {
    const message = messageWith([{ user: 'someone-else', emoji: 'like' }]);
    jest.spyOn(Message, 'findOne').mockResolvedValue(message as any);

    const res = await react('like');

    expect(res.status).toBe(400);
    expect(message.reactions).toHaveLength(1);
  });
});
