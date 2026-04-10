import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { ChatGroup, Message, ForumTopic, ForumReply, User } from '../models';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';
import { notificationService } from '../services/notification.service';
import { parsePagination, getSkip } from '../utils/pagination';
import { broadcastChatMessage, broadcastDM } from '../socket';

/** Check if role is Admin or above */
function isAdminOrAbove(role: string): boolean {
  return ROLE_HIERARCHY.indexOf(role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
}

/** Permission to add/remove members on a group: admin+, OR creator of a custom group. */
function canManageGroupMembers(group: { type: string; createdBy?: any }, user: { _id: any; role: string }): boolean {
  if (isAdminOrAbove(user.role)) return true;
  if (group.type === 'custom' && group.createdBy?.toString() === user._id.toString()) return true;
  return false;
}

/** Media retention policy in days, keyed by attachment kind. */
const RETENTION_DAYS: Record<string, number> = {
  image: 30,
  video: 7,
  audio: 30,
  pdf: 30,
  file: 30,
};

/** Time window (ms) within which the sender can edit their own message. */
const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;        // 6 hours
/** Time window (ms) within which the sender can delete their message for everyone. */
const DELETE_EVERYONE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
/** Time window (ms) within which any participant can delete the message just for themselves. */
const DELETE_FOR_ME_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24 hours

function isWithin(windowMs: number, sentAt: Date): boolean {
  return Date.now() - sentAt.getTime() <= windowMs;
}

/**
 * Delete a message's attached files from Cloudinary immediately.
 * Used when a message is hard-deleted (delete-for-everyone) before its
 * normal retention window has elapsed, so we don't pay for stale storage.
 */
async function purgeMessageAttachments(message: { attachments: any[] }): Promise<void> {
  const { cloudinary } = await import('../config/cloudinary');
  for (const att of message.attachments || []) {
    if (att.expired || !att.publicId) continue;
    try {
      await cloudinary.uploader.destroy(att.publicId, {
        resource_type: att.resourceType || 'image',
        invalidate: true,
      });
    } catch (err) {
      console.error(`[purgeMessageAttachments] destroy failed for ${att.publicId}:`, err);
    }
    att.expired = true;
    att.url = undefined;
    att.publicId = undefined;
  }
}

/**
 * Validate and normalize the client-supplied attachments[] array for a new message.
 * - Drops unknown kinds
 * - Stamps expiresAt on media attachments based on the retention policy
 * - Contact attachments are passed through without expiry
 * - Returns a clean array ready to assign to Message.attachments
 *
 * Does NOT enforce "at least one of content/attachments" — the caller does that.
 */
function buildAttachments(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  const out: any[] = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue;
    const kind = a.kind;
    if (!['image', 'video', 'audio', 'pdf', 'file', 'contact'].includes(kind)) continue;

    if (kind === 'contact') {
      if (!a.contact?.name) continue; // contact must have a display name
      out.push({
        kind: 'contact',
        contact: {
          userId: a.contact.userId,
          name: a.contact.name,
          phone: a.contact.phone,
          email: a.contact.email,
          avatar: a.contact.avatar,
        },
      });
      continue;
    }

    // Media attachment
    if (!a.url || !a.publicId) continue; // require a valid Cloudinary upload result
    const retentionDays = RETENTION_DAYS[kind] ?? 90;
    out.push({
      kind,
      url: a.url,
      publicId: a.publicId,
      resourceType: a.resourceType,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      width: a.width,
      height: a.height,
      duration: a.duration,
      expiresAt: new Date(now + retentionDays * 24 * 60 * 60 * 1000),
      expired: false,
    });
  }
  return out;
}

const router = Router();

// ── Chat Groups ──

// List my groups (Admin+ sees all groups)
router.get('/groups', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const filter: any = { isDeleted: false };
  // Admin+ can see all groups; others only their own
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const groups = await ChatGroup.find(filter)
    .populate('members', 'name avatar').sort({ updatedAt: -1 });
  ApiResponse.success(res, groups);
}));

// Create custom group (Moderator+). Always creates type='custom' — central and department
// groups are system-managed and cannot be created via this endpoint.
// Auto-seeds all Admin/SuperAdmin as members+admins so they can manage the group.
// The creator is recorded so they can manage members alongside admins.
router.post('/groups', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { name, description, avatar, members: extraMembers } = req.body;
  if (!name?.trim()) throw ApiError.badRequest('Group name is required');

  // Fetch all admin/superadmin users to auto-add
  const adminUsers = await User.find({
    isDeleted: false, isActive: true,
    role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  }).select('_id').lean();
  const adminIds = adminUsers.map((u) => u._id.toString());

  const memberSet = new Set<string>([
    req.user._id.toString(),
    ...(Array.isArray(extraMembers) ? extraMembers.map(String) : []),
    ...adminIds,
  ]);

  const group = await ChatGroup.create({
    name: name.trim(),
    description,
    avatar,
    type: 'custom',
    createdBy: req.user._id,
    admins: [...new Set([req.user._id.toString(), ...adminIds])],
    members: [...memberSet],
  });
  ApiResponse.created(res, group);
}));

// Browse groups user is NOT in (must be before :id route)
router.get('/groups/browse', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const groups = await ChatGroup.find({
    isDeleted: false,
    members: { $ne: req.user._id },
  }).select('name description type department avatar members joinRequests').sort({ updatedAt: -1 });

  const result = groups.map((g) => ({
    _id: g._id,
    name: g.name,
    description: (g as any).description,
    type: g.type,
    department: g.department,
    avatar: g.avatar,
    memberCount: g.members.length,
    hasPendingRequest: g.joinRequests?.some(
      (r) => r.user.toString() === req.user!._id.toString() && r.status === 'pending'
    ) || false,
  }));
  ApiResponse.success(res, result);
}));

// Get group with recent messages (Admin+ can access any group)
router.get('/groups/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter)
    .populate('members', 'name avatar')
    .populate('createdBy', 'name avatar');
  if (!group) throw ApiError.notFound('Group not found');

  const messages = await Message.find({
    group: id,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
  })
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  ApiResponse.success(res, { group, messages: messages.reverse() });
}));

// Send message to group (Admin+ can post to any group)
router.post('/groups/:id/messages', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter);
  if (!group) throw ApiError.notFound('Group not found');

  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const attachments = buildAttachments(req.body.attachments);
  if (!content && attachments.length === 0) {
    throw ApiError.badRequest('Message must have text or at least one attachment');
  }

  const message = await Message.create({
    group: id,
    sender: req.user._id,
    content,
    attachments,
  });
  await message.populate('sender', 'name avatar');

  group.updatedAt = new Date();
  await group.save();

  // Real-time broadcast to group room
  broadcastChatMessage(id, message);

  ApiResponse.created(res, message);
}));

// Edit message — sender only, within EDIT_WINDOW. Admins bypass the time window for moderation.
router.patch('/groups/:id/messages/:messageId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const isSender = message.sender.toString() === req.user._id.toString();
  const isAdmin = isAdminOrAbove(req.user.role);
  if (!isSender && !isAdmin) {
    throw ApiError.forbidden('Cannot edit this message');
  }
  if (isSender && !isAdmin && !isWithin(EDIT_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Edit window expired. Messages can only be edited within 6 hours of sending.');
  }

  const newContent = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!newContent) {
    throw ApiError.badRequest('Message content cannot be empty');
  }
  if (newContent !== message.content) {
    message.content = newContent;
    message.isEdited = true;
    await message.save();
  }
  await message.populate('sender', 'name avatar');
  ApiResponse.success(res, message, 'Message updated');
}));

// Delete message for everyone — sender within DELETE_EVERYONE_WINDOW, or Admin+ any time.
// Also immediately purges any attached files from Cloudinary so we don't pay for stale storage.
router.delete('/groups/:id/messages/:messageId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const isSender = message.sender.toString() === req.user._id.toString();
  const isAdmin = isAdminOrAbove(req.user.role);
  if (!isSender && !isAdmin) {
    throw ApiError.forbidden('Cannot delete this message');
  }
  if (isSender && !isAdmin && !isWithin(DELETE_EVERYONE_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Delete window expired. Messages can only be deleted for everyone within 12 hours of sending.');
  }

  await purgeMessageAttachments(message);
  message.isDeleted = true;
  await message.save();
  ApiResponse.success(res, null, 'Message deleted');
}));

// Delete message just for the current user — any participant, within DELETE_FOR_ME_WINDOW.
// The message remains visible to everyone else; only the requesting user no longer sees it.
router.delete('/groups/:id/messages/:messageId/me', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  if (!isWithin(DELETE_FOR_ME_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Delete window expired. Messages can only be hidden within 24 hours of sending.');
  }

  await Message.findByIdAndUpdate(messageId, {
    $addToSet: { deletedFor: req.user._id },
  });
  ApiResponse.success(res, null, 'Message hidden for you');
}));

// Admin+ can delete entire group
router.delete('/groups/:id', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const group = await ChatGroup.findById(id);
  if (!group) throw ApiError.notFound('Group not found');
  group.isDeleted = true;
  await group.save();
  ApiResponse.success(res, null, 'Group deleted');
}));

// ── Add/Remove Members ──
// Permission: Admin+ for any group, OR creator of a custom group.

// Add user to a group
router.post('/groups/:id/members', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const { userId } = req.body;
  if (!userId) throw ApiError.badRequest('userId is required');

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (!canManageGroupMembers(group, req.user)) {
    throw ApiError.forbidden('Not authorized to manage members of this group');
  }

  if (group.members.map(String).includes(userId)) {
    throw ApiError.badRequest('User is already a member');
  }

  await ChatGroup.findByIdAndUpdate(id, { $addToSet: { members: userId } });
  ApiResponse.success(res, null, 'User added to group');
}));

// Remove user from a group
router.delete('/groups/:id/members/:userId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const userId = req.params.userId as string;

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (!canManageGroupMembers(group, req.user)) {
    throw ApiError.forbidden('Not authorized to manage members of this group');
  }

  await ChatGroup.findByIdAndUpdate(id, {
    $pull: { members: userId, admins: userId },
  });
  ApiResponse.success(res, null, 'User removed from group');
}));

// User leaves a group themselves. Only allowed for custom groups —
// central and department groups are membership-tied and managed by admins.
router.delete('/groups/:id/leave', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (group.type !== 'custom') {
    throw ApiError.badRequest('You cannot leave central or department groups. These are managed by administrators.');
  }

  const userId = req.user._id.toString();
  if (!group.members.map(String).includes(userId)) {
    throw ApiError.badRequest('You are not a member of this group');
  }

  await ChatGroup.findByIdAndUpdate(id, {
    $pull: { members: req.user._id, admins: req.user._id },
  });
  ApiResponse.success(res, null, 'You left the group');
}));

// ── Join Requests ──

// User requests to join a group
router.post('/groups/:id/join', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (group.members.map(String).includes(req.user._id.toString())) {
    throw ApiError.badRequest('You are already a member of this group');
  }

  const existingRequest = group.joinRequests?.find(
    (r) => r.user.toString() === req.user!._id.toString() && r.status === 'pending'
  );
  if (existingRequest) {
    throw ApiError.badRequest('You already have a pending join request');
  }

  group.joinRequests.push({
    user: req.user._id,
    message: req.body.message || '',
    status: 'pending',
    requestedAt: new Date(),
  } as any);
  await group.save();

  ApiResponse.success(res, null, 'Join request submitted');
}));

// List pending join requests for a group (Admin+ or group admin)
router.get('/groups/:id/join-requests', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const group = await ChatGroup.findOne({ _id: id, isDeleted: false })
    .populate('joinRequests.user', 'name email avatar department batch');
  if (!group) throw ApiError.notFound('Group not found');

  const isGroupAdmin = group.admins.map(String).includes(req.user._id.toString());
  if (!isGroupAdmin && !isAdminOrAbove(req.user.role)) {
    throw ApiError.forbidden('Not authorized to view join requests');
  }

  const pending = group.joinRequests.filter((r) => r.status === 'pending');
  ApiResponse.success(res, pending);
}));

// Approve/Reject join request (Admin+ or group admin)
router.patch('/groups/:id/join-requests/:requestId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const requestId = req.params.requestId as string;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw ApiError.badRequest('action must be "approve" or "reject"');
  }

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  const isGroupAdmin = group.admins.map(String).includes(req.user._id.toString());
  if (!isGroupAdmin && !isAdminOrAbove(req.user.role)) {
    throw ApiError.forbidden('Not authorized to manage join requests');
  }

  const request = group.joinRequests.find((r: any) => r._id?.toString() === requestId);
  if (!request) throw ApiError.notFound('Join request not found');
  if (request.status !== 'pending') throw ApiError.badRequest('Request already processed');

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();

  if (action === 'approve') {
    group.members.push(request.user);
  }

  await group.save();

  // Notify the requester
  await notificationService.send({
    recipientId: request.user,
    type: 'system',
    title: action === 'approve' ? 'Join Request Approved' : 'Join Request Rejected',
    message: action === 'approve'
      ? `Your request to join "${group.name}" has been approved!`
      : `Your request to join "${group.name}" has been rejected.`,
    link: action === 'approve' ? `/communication/groups/${group._id}` : undefined,
  });

  ApiResponse.success(res, null, `Request ${action}d`);
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
        deletedFor: { $ne: userId },
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

  const dmFilter: any = {
    group: null,
    isDeleted: false,
    deletedFor: { $ne: myId },
    $or: [
      { sender: myId, recipient: userId },
      { sender: userId, recipient: myId },
    ],
  };
  const [messages, total] = await Promise.all([
    Message.find(dmFilter)
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Message.countDocuments(dmFilter),
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

  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const attachments = buildAttachments(req.body.attachments);
  if (!content && attachments.length === 0) {
    throw ApiError.badRequest('Message must have text or at least one attachment');
  }

  const message = await Message.create({
    sender: req.user._id,
    recipient: userId,
    content,
    attachments,
  });
  await message.populate('sender', 'name avatar');

  // Real-time broadcast to both users
  broadcastDM(req.user._id.toString(), userId, message);

  ApiResponse.created(res, message);
}));

// Edit DM — sender only, within EDIT_WINDOW
router.patch('/dm/messages/:messageId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, group: null, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const isSender = message.sender.toString() === req.user._id.toString();
  if (!isSender) {
    throw ApiError.forbidden('Cannot edit this message');
  }
  if (!isWithin(EDIT_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Edit window expired. Messages can only be edited within 6 hours of sending.');
  }

  const newContent = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!newContent) {
    throw ApiError.badRequest('Message content cannot be empty');
  }
  if (newContent !== message.content) {
    message.content = newContent;
    message.isEdited = true;
    await message.save();
  }
  await message.populate('sender', 'name avatar');
  ApiResponse.success(res, message, 'Message updated');
}));

// Delete DM for everyone — sender within DELETE_EVERYONE_WINDOW
router.delete('/dm/messages/:messageId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, group: null, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const isSender = message.sender.toString() === req.user._id.toString();
  if (!isSender) {
    throw ApiError.forbidden('Cannot delete this message');
  }
  if (!isWithin(DELETE_EVERYONE_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Delete window expired. Messages can only be deleted for everyone within 12 hours of sending.');
  }

  await purgeMessageAttachments(message);
  message.isDeleted = true;
  await message.save();
  ApiResponse.success(res, null, 'Message deleted');
}));

// Delete DM just for the current user — either participant, within DELETE_FOR_ME_WINDOW
router.delete('/dm/messages/:messageId/me', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, group: null, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  // Must be sender or recipient
  const isSender = message.sender.toString() === req.user._id.toString();
  const isRecipient = message.recipient?.toString() === req.user._id.toString();
  if (!isSender && !isRecipient) {
    throw ApiError.forbidden('Cannot hide this message');
  }
  if (!isWithin(DELETE_FOR_ME_WINDOW_MS, message.createdAt)) {
    throw ApiError.badRequest('Delete window expired. Messages can only be hidden within 24 hours of sending.');
  }

  await Message.findByIdAndUpdate(messageId, {
    $addToSet: { deletedFor: req.user._id },
  });
  ApiResponse.success(res, null, 'Message hidden for you');
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

// Edit forum reply (own reply or Admin+)
router.patch('/forum/:id/reply/:replyId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const replyId = req.params.replyId as string;
  const reply = await ForumReply.findOne({ _id: replyId, isDeleted: false });
  if (!reply) throw ApiError.notFound('Reply not found');

  if (reply.author.toString() !== req.user._id.toString() && !isAdminOrAbove(req.user.role)) {
    throw ApiError.forbidden('Cannot edit this reply');
  }

  reply.content = req.body.content || reply.content;
  await reply.save();
  await reply.populate('author', 'name avatar');
  ApiResponse.success(res, reply, 'Reply updated');
}));

// Delete forum reply (own reply or Moderator+)
router.delete('/forum/:id/reply/:replyId', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const replyId = req.params.replyId as string;
  const reply = await ForumReply.findOne({ _id: replyId, isDeleted: false });
  if (!reply) throw ApiError.notFound('Reply not found');

  const isMod = ROLE_HIERARCHY.indexOf(req.user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
  if (reply.author.toString() !== req.user._id.toString() && !isMod) {
    throw ApiError.forbidden('Cannot delete this reply');
  }

  reply.isDeleted = true;
  await reply.save();

  // Decrement reply count on topic
  await ForumTopic.findByIdAndUpdate(id, { $inc: { replyCount: -1 } });

  ApiResponse.success(res, null, 'Reply deleted');
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

// ── Announcement Channel ──

// Post announcement to central group (Moderator+)
router.post('/announcements', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { title, content, link } = req.body;
  if (!title || !content) throw ApiError.badRequest('Title and content are required');

  // Find or create the central announcement group
  let centralGroup = await ChatGroup.findOne({ type: 'central', isDeleted: false });
  if (!centralGroup) {
    const allMembers = await User.find({ isDeleted: false, isActive: true }).select('_id');
    centralGroup = await ChatGroup.create({
      name: 'RDSWA Central',
      type: 'central',
      members: allMembers.map((u) => u._id),
      admins: [req.user._id],
    });
  }

  // Post message to the central group
  const message = await Message.create({
    group: centralGroup._id,
    sender: req.user._id,
    content: `**${title}**\n\n${content}`,
  });
  await message.populate('sender', 'name avatar');

  centralGroup.updatedAt = new Date();
  await centralGroup.save();

  // Send notification to all members
  const recipientIds = centralGroup.members
    .map((m) => m.toString())
    .filter((id) => id !== req.user!._id.toString());

  if (recipientIds.length > 0) {
    await notificationService.sendBulk({
      recipientIds,
      type: 'announcement',
      title,
      message: content.substring(0, 200),
      link: link || `/communication/groups/${centralGroup._id}`,
    });
  }

  ApiResponse.created(res, message);
}));

// Get announcements (from central group)
router.get('/announcements', authenticate(), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const centralGroup = await ChatGroup.findOne({ type: 'central', isDeleted: false });
  if (!centralGroup) {
    return ApiResponse.paginated(res, [], 0, page, limit);
  }

  const [messages, total] = await Promise.all([
    Message.find({ group: centralGroup._id, isDeleted: false })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Message.countDocuments({ group: centralGroup._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, messages, total, page, limit);
}));

export default router;
