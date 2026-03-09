import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { ChatGroup, Message, ForumTopic, ForumReply } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// ── Chat Groups ──

// List my groups
router.get('/groups', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const groups = await ChatGroup.find({
    members: req.user._id,
    isDeleted: false,
  }).populate('members', 'name avatar').sort({ updatedAt: -1 });
  ApiResponse.success(res, groups);
}));

// Create group
router.post('/groups', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const group = await ChatGroup.create({
    ...req.body,
    admins: [req.user._id],
    members: [...new Set([req.user._id.toString(), ...(req.body.members || [])])],
  });
  ApiResponse.created(res, group);
}));

// Get group with recent messages
router.get('/groups/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const group = await ChatGroup.findOne({
    _id: id,
    members: req.user._id,
    isDeleted: false,
  }).populate('members', 'name avatar');
  if (!group) throw ApiError.notFound('Group not found');

  const messages = await Message.find({ group: id, isDeleted: false })
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  ApiResponse.success(res, { group, messages: messages.reverse() });
}));

// Send message to group
router.post('/groups/:id/messages', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const group = await ChatGroup.findOne({ _id: id, members: req.user._id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  const message = await Message.create({
    group: id,
    sender: req.user._id,
    content: req.body.content,
    attachments: req.body.attachments,
  });
  await message.populate('sender', 'name avatar');

  group.updatedAt = new Date();
  await group.save();

  ApiResponse.created(res, message);
}));

// ── Direct Messages ──

// Get DM conversations (list of users I've messaged)
router.get('/dm', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user._id;

  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: userId }, { recipient: userId }],
        group: null,
        isDeleted: false,
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$sender', userId] }, '$recipient', '$sender'],
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$isRead', false] }] }, 1, 0],
          },
        },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  // Populate user info
  const User = (await import('../models')).User;
  const userIds = conversations.map((c: any) => c._id);
  const users = await User.find({ _id: { $in: userIds } }).select('name avatar').lean();
  const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

  const result = conversations.map((c: any) => ({
    user: userMap.get(c._id.toString()),
    lastMessage: c.lastMessage,
    unreadCount: c.unreadCount,
  }));

  ApiResponse.success(res, result);
}));

// Get DMs with specific user
router.get('/dm/:userId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { page, limit } = parsePagination(req.query as any);
  const userId = req.params.userId as string;
  const myId = req.user._id;

  const [messages, total] = await Promise.all([
    Message.find({
      group: null,
      isDeleted: false,
      $or: [
        { sender: myId, recipient: userId },
        { sender: userId, recipient: myId },
      ],
    })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Message.countDocuments({
      group: null,
      isDeleted: false,
      $or: [
        { sender: myId, recipient: userId },
        { sender: userId, recipient: myId },
      ],
    }),
  ]);

  // Mark received messages as read
  await Message.updateMany(
    { sender: userId, recipient: myId, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  ApiResponse.paginated(res, messages.reverse(), total, page, limit);
}));

// Send DM
router.post('/dm/:userId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.params.userId as string;

  const message = await Message.create({
    sender: req.user._id,
    recipient: userId,
    content: req.body.content,
    attachments: req.body.attachments,
  });
  await message.populate('sender', 'name avatar');

  ApiResponse.created(res, message);
}));

// ── Forum ──

// List forum topics
router.get('/forum', authenticate(), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false };
  if (req.query.category) filter.category = req.query.category;

  const [topics, total] = await Promise.all([
    ForumTopic.find(filter)
      .populate('author', 'name avatar')
      .sort({ isPinned: -1, lastReplyAt: -1, createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    ForumTopic.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, topics, total, page, limit);
}));

// Create topic
router.post('/forum', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const topic = await ForumTopic.create({
    title: req.body.title,
    content: req.body.content,
    category: req.body.category,
    author: req.user._id,
    lastReplyAt: new Date(),
  });
  ApiResponse.created(res, topic);
}));

// Get topic with replies
router.get('/forum/:id', authenticate(), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const topic = await ForumTopic.findOne({ _id: id, isDeleted: false })
    .populate('author', 'name avatar');
  if (!topic) throw ApiError.notFound('Topic not found');

  const replies = await ForumReply.find({ topic: id, isDeleted: false })
    .populate('author', 'name avatar')
    .sort({ createdAt: 1 });

  ApiResponse.success(res, { topic, replies });
}));

// Reply to topic
router.post('/forum/:id/reply', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const topic = await ForumTopic.findOne({ _id: id, isDeleted: false });
  if (!topic) throw ApiError.notFound('Topic not found');
  if (topic.isLocked) throw ApiError.badRequest('Topic is locked');

  const reply = await ForumReply.create({
    topic: id,
    author: req.user._id,
    content: req.body.content,
  });

  topic.replyCount = (topic.replyCount || 0) + 1;
  topic.lastReplyAt = new Date();
  await topic.save();

  await reply.populate('author', 'name avatar');
  ApiResponse.created(res, reply);
}));

// Pin/lock topic (moderator+)
router.patch('/forum/:id', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const topic = await ForumTopic.findOne({ _id: id, isDeleted: false });
  if (!topic) throw ApiError.notFound('Topic not found');

  if (req.body.isPinned !== undefined) topic.isPinned = req.body.isPinned;
  if (req.body.isLocked !== undefined) topic.isLocked = req.body.isLocked;
  await topic.save();

  ApiResponse.success(res, topic);
}));

// Delete topic (moderator+)
router.delete('/forum/:id', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  await ForumTopic.findByIdAndUpdate(id, { isDeleted: true });
  ApiResponse.noContent(res);
}));

export default router;
