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
import {
  broadcastChatMessage,
  broadcastChatMessageEdit,
  broadcastChatMessageDelete,
  broadcastChatReaction,
  broadcastChatRead,
  broadcastDM,
  broadcastDMEdit,
  broadcastDMDelete,
  broadcastDMReaction,
  broadcastDMRead,
} from '../socket';

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
/**
 * Build a denormalized reply snapshot from a replyToId.
 * Loads just enough of the parent message to render a quoted preview without
 * a second round trip.
 */
async function buildReplySnapshot(replyToId: unknown): Promise<any | undefined> {
  if (typeof replyToId !== 'string') return undefined;
  const parent = await Message.findOne({ _id: replyToId, isDeleted: false })
    .populate('sender', 'name')
    .select('sender content attachments')
    .lean();
  if (!parent) return undefined;
  const snapContent = (parent.content || '').slice(0, 200);
  const firstAttachment = parent.attachments?.[0];
  return {
    messageId: parent._id,
    senderId: (parent.sender as any)._id || parent.sender,
    senderName: (parent.sender as any).name || 'Unknown',
    content: snapContent,
    attachmentKind: firstAttachment?.kind,
  };
}

/** Allowed emoji reaction set. Anything else is rejected. */
const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉']);

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

// Get group with recent messages. Supports cursor pagination via ?before=ISO.
// Admin+ can access any group.
router.get('/groups/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter)
    .populate('members', 'name avatar lastSeenAt')
    .populate('createdBy', 'name avatar');
  if (!group) throw ApiError.notFound('Group not found');

  const msgFilter: any = {
    group: id,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
  };
  if (typeof req.query.before === 'string') {
    const beforeDate = new Date(req.query.before);
    if (!isNaN(beforeDate.getTime())) msgFilter.createdAt = { $lt: beforeDate };
  }
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const messages = await Message.find(msgFilter)
    .populate('sender', 'name avatar')
    .populate('reactions.user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  const isMuted = group.mutedBy?.some((u: any) => u.toString() === req.user!._id.toString()) || false;

  ApiResponse.success(res, {
    group: { ...group.toObject(), isMuted },
    messages: messages.reverse(),
    hasMore,
  });
}));

// List pinned messages for a group.
router.get('/groups/:id/pinned', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter).select('_id');
  if (!group) throw ApiError.notFound('Group not found');

  const pinned = await Message.find({
    group: id,
    isDeleted: false,
    pinnedAt: { $ne: null },
    deletedFor: { $ne: req.user._id },
  })
    .populate('sender', 'name avatar')
    .populate('pinnedBy', 'name')
    .sort({ pinnedAt: -1 })
    .limit(20);

  ApiResponse.success(res, pinned);
}));

// Search messages in a group by text.
router.get('/groups/:id/search', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const q = (req.query.q as string || '').trim();
  if (q.length < 2) throw ApiError.badRequest('Search query must be at least 2 characters');

  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter).select('_id');
  if (!group) throw ApiError.notFound('Group not found');

  const results = await Message.find({
    group: id,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
    content: { $regex: q, $options: 'i' },
  })
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  ApiResponse.success(res, results);
}));

// Mute / unmute notifications for a group (per user).
router.patch('/groups/:id/mute', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const { mute } = req.body;

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');

  if (!isAdminOrAbove(req.user.role) && !group.members.map(String).includes(req.user._id.toString())) {
    throw ApiError.forbidden('Not a member of this group');
  }

  if (mute) {
    await ChatGroup.findByIdAndUpdate(id, { $addToSet: { mutedBy: req.user._id } });
  } else {
    await ChatGroup.findByIdAndUpdate(id, { $pull: { mutedBy: req.user._id } });
  }
  ApiResponse.success(res, { isMuted: !!mute }, mute ? 'Muted' : 'Unmuted');
}));

// Mark a batch of group messages as read by the current user.
// Clients call this when the chat window is focused and messages are visible.
router.post('/groups/:id/messages/read', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return ApiResponse.success(res, null, 'Nothing to mark');
  }

  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter).select('_id');
  if (!group) throw ApiError.notFound('Group not found');

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      group: id,
      'readBy.user': { $ne: req.user._id },
    },
    { $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
  );

  broadcastChatRead(id, messageIds.map(String), req.user._id.toString());
  ApiResponse.success(res, null, 'Marked as read');
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

  const replyTo = await buildReplySnapshot(req.body.replyToId);
  const forwardedFrom = typeof req.body.forwardedFromId === 'string' ? req.body.forwardedFromId : undefined;

  const message = await Message.create({
    group: id,
    sender: req.user._id,
    content,
    attachments,
    replyTo,
    forwardedFrom,
  });
  await message.populate('sender', 'name avatar');

  group.updatedAt = new Date();
  await group.save();

  // Real-time broadcast to group room
  broadcastChatMessage(id, message);

  ApiResponse.created(res, message);
}));

// Toggle a reaction on a group message. Each user has one slot — sending the
// same emoji twice removes it; sending a different emoji replaces.
router.post('/groups/:id/messages/:messageId/react', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { id, messageId } = req.params;
  const { emoji } = req.body;

  const filter: any = { _id: id, isDeleted: false };
  if (!isAdminOrAbove(req.user.role)) {
    filter.members = req.user._id;
  }
  const group = await ChatGroup.findOne(filter).select('_id');
  if (!group) throw ApiError.notFound('Group not found');

  const message = await Message.findOne({ _id: messageId as string, group: id, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const userId = req.user._id.toString();
  const existing = message.reactions.find((r: any) => r.user.toString() === userId);

  if (!emoji) {
    // No emoji = remove the user's reaction.
    message.reactions = message.reactions.filter((r: any) => r.user.toString() !== userId);
  } else {
    if (!ALLOWED_REACTIONS.has(emoji)) throw ApiError.badRequest('Unsupported reaction');
    if (existing && existing.emoji === emoji) {
      // Toggle off when re-reacting with the same emoji.
      message.reactions = message.reactions.filter((r: any) => r.user.toString() !== userId);
    } else if (existing) {
      existing.emoji = emoji;
      existing.reactedAt = new Date();
    } else {
      message.reactions.push({ user: req.user._id as any, emoji, reactedAt: new Date() });
    }
  }
  await message.save();
  await message.populate('reactions.user', 'name avatar');

  const reactionsPayload = message.reactions.map((r: any) => ({
    user: r.user._id ? { _id: r.user._id, name: r.user.name, avatar: r.user.avatar } : r.user,
    emoji: r.emoji,
  }));
  broadcastChatReaction(id as string, messageId as string, reactionsPayload);

  ApiResponse.success(res, { reactions: reactionsPayload });
}));

// Toggle pin on a group message. Admin+ or group creator only.
router.post('/groups/:id/messages/:messageId/pin', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { id, messageId } = req.params;

  const group = await ChatGroup.findOne({ _id: id, isDeleted: false });
  if (!group) throw ApiError.notFound('Group not found');
  if (!canManageGroupMembers(group, req.user)) {
    throw ApiError.forbidden('Only admins or the group creator can pin messages');
  }

  const message = await Message.findOne({ _id: messageId as string, group: id, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  if (message.pinnedAt) {
    message.pinnedAt = undefined;
    message.pinnedBy = undefined;
  } else {
    message.pinnedAt = new Date();
    message.pinnedBy = req.user._id as any;
  }
  await message.save();
  await message.populate('sender', 'name avatar');
  await message.populate('pinnedBy', 'name');
  broadcastChatMessageEdit(id as string, message);
  ApiResponse.success(res, message, message.pinnedAt ? 'Pinned' : 'Unpinned');
}));

// Toggle star (personal bookmark) on any message — group or DM.
router.post('/messages/:messageId/star', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const message = await Message.findOne({ _id: messageId as string, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  // Verify the user can see this message (group member, DM participant, or admin).
  const userId = req.user._id.toString();
  let canAccess = isAdminOrAbove(req.user.role);
  if (!canAccess && message.group) {
    const group = await ChatGroup.findOne({ _id: message.group, isDeleted: false }).select('members');
    canAccess = !!group && group.members.map(String).includes(userId);
  }
  if (!canAccess && !message.group) {
    canAccess =
      message.sender.toString() === userId ||
      message.recipient?.toString() === userId;
  }
  if (!canAccess) throw ApiError.forbidden('Cannot star this message');

  const isStarred = message.starredBy.some((u: any) => u.toString() === userId);
  if (isStarred) {
    await Message.findByIdAndUpdate(messageId, { $pull: { starredBy: req.user._id } });
  } else {
    await Message.findByIdAndUpdate(messageId, { $addToSet: { starredBy: req.user._id } });
  }
  ApiResponse.success(res, { isStarred: !isStarred });
}));

// List the current user's starred messages across all chats.
router.get('/messages/starred', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const messages = await Message.find({
    starredBy: req.user._id,
    isDeleted: false,
    deletedFor: { $ne: req.user._id },
  })
    .populate('sender', 'name avatar')
    .populate('group', 'name type')
    .sort({ createdAt: -1 })
    .limit(100);
  ApiResponse.success(res, messages);
}));

// Forward a message to multiple targets (groups and/or users).
// Body: { messageId: string, groupIds?: string[], userIds?: string[] }
router.post('/messages/:messageId/forward', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const groupIds: string[] = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
  const userIds: string[] = Array.isArray(req.body.userIds) ? req.body.userIds : [];
  if (groupIds.length === 0 && userIds.length === 0) {
    throw ApiError.badRequest('Pick at least one destination');
  }

  const original = await Message.findOne({ _id: messageId as string, isDeleted: false });
  if (!original) throw ApiError.notFound('Message not found');

  // Verify the sender can see the original.
  const userId = req.user._id.toString();
  let canAccess = isAdminOrAbove(req.user.role);
  if (!canAccess && original.group) {
    const group = await ChatGroup.findOne({ _id: original.group, isDeleted: false }).select('members');
    canAccess = !!group && group.members.map(String).includes(userId);
  }
  if (!canAccess && !original.group) {
    canAccess =
      original.sender.toString() === userId ||
      original.recipient?.toString() === userId;
  }
  if (!canAccess) throw ApiError.forbidden('Cannot forward this message');

  // Strip retention dates so the forwarded copies get fresh windows from buildAttachments.
  const forwardAttachments = buildAttachments(
    (original.attachments || []).map((a: any) => ({
      kind: a.kind,
      url: a.url,
      publicId: a.publicId,
      resourceType: a.resourceType,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      width: a.width,
      height: a.height,
      duration: a.duration,
      contact: a.contact,
    }))
  );

  const created: any[] = [];
  for (const gid of groupIds) {
    const filter: any = { _id: gid, isDeleted: false };
    if (!isAdminOrAbove(req.user.role)) filter.members = req.user._id;
    const group = await ChatGroup.findOne(filter);
    if (!group) continue;

    const msg = await Message.create({
      group: gid,
      sender: req.user._id,
      content: original.content,
      attachments: forwardAttachments,
      forwardedFrom: original._id,
    });
    await msg.populate('sender', 'name avatar');
    broadcastChatMessage(gid, msg);
    created.push(msg);
  }

  for (const uid of userIds) {
    const msg = await Message.create({
      sender: req.user._id,
      recipient: uid,
      content: original.content,
      attachments: forwardAttachments,
      forwardedFrom: original._id,
    });
    await msg.populate('sender', 'name avatar');
    broadcastDM(req.user._id.toString(), uid, msg);
    created.push(msg);
  }

  ApiResponse.success(res, { count: created.length }, `Forwarded to ${created.length} chat${created.length === 1 ? '' : 's'}`);
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
  broadcastChatMessageEdit(req.params.id as string, message);
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
  broadcastChatMessageDelete(req.params.id as string, messageId as string);
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

  if (group.type !== 'custom' && group.type !== 'consultation') {
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

// Total unread messages for the current user. Counts DMs only — group
// messages don't have a reliable per-user "opened the group" signal (readBy
// is only populated when a member actively scrolls through individual
// messages), so including them produces phantom unread counts for groups
// the user has already browsed. If/when groups track lastVisitedAt per
// member this can be expanded. See Message.isRead for the DM signal.
router.get('/messages/unread-count', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user._id;

  const dmUnread = await Message.countDocuments({
    recipient: userId,
    group: null,
    isRead: false,
    sender: { $ne: userId },
    isDeleted: false,
    deletedFor: { $ne: userId },
  });

  ApiResponse.success(res, { count: dmUnread, dmCount: dmUnread });
}));

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
      .populate('reactions.user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Message.countDocuments(dmFilter),
  ]);

  // Mark received messages as read and notify both participants in real-time
  // so the sender's ticks flip and the recipient's bell count refreshes.
  const unread = await Message.find({
    sender: userId, recipient: myId, isRead: false, group: null,
  }).select('_id').lean();
  if (unread.length > 0) {
    const ids = unread.map((m: any) => m._id);
    await Message.updateMany(
      { _id: { $in: ids } },
      { isRead: true, readAt: new Date() },
    );
    broadcastDMRead(req.user._id.toString(), userId, ids.map((i: any) => i.toString()));
  }

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

  const replyTo = await buildReplySnapshot(req.body.replyToId);
  const forwardedFrom = typeof req.body.forwardedFromId === 'string' ? req.body.forwardedFromId : undefined;

  const message = await Message.create({
    sender: req.user._id,
    recipient: userId,
    content,
    attachments,
    replyTo,
    forwardedFrom,
  });
  await message.populate('sender', 'name avatar');

  // Real-time broadcast to both users
  broadcastDM(req.user._id.toString(), userId, message);

  ApiResponse.created(res, message);
}));

// Toggle a reaction on a DM message.
router.post('/dm/messages/:messageId/react', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageId } = req.params;
  const { emoji } = req.body;

  const message = await Message.findOne({ _id: messageId as string, group: null, isDeleted: false });
  if (!message) throw ApiError.notFound('Message not found');

  const userId = req.user._id.toString();
  const isParticipant =
    message.sender.toString() === userId || message.recipient?.toString() === userId;
  if (!isParticipant) throw ApiError.forbidden('Cannot react to this message');

  const existing = message.reactions.find((r: any) => r.user.toString() === userId);
  if (!emoji) {
    message.reactions = message.reactions.filter((r: any) => r.user.toString() !== userId);
  } else {
    if (!ALLOWED_REACTIONS.has(emoji)) throw ApiError.badRequest('Unsupported reaction');
    if (existing && existing.emoji === emoji) {
      message.reactions = message.reactions.filter((r: any) => r.user.toString() !== userId);
    } else if (existing) {
      existing.emoji = emoji;
      existing.reactedAt = new Date();
    } else {
      message.reactions.push({ user: req.user._id as any, emoji, reactedAt: new Date() });
    }
  }
  await message.save();
  await message.populate('reactions.user', 'name avatar');

  const reactionsPayload = message.reactions.map((r: any) => ({
    user: r.user._id ? { _id: r.user._id, name: r.user.name, avatar: r.user.avatar } : r.user,
    emoji: r.emoji,
  }));
  const otherId = message.sender.toString() === userId
    ? message.recipient!.toString()
    : message.sender.toString();
  broadcastDMReaction(userId, otherId, messageId as string, reactionsPayload);

  ApiResponse.success(res, { reactions: reactionsPayload });
}));

// Mark a batch of DMs as read by the current user (must be the recipient).
router.post('/dm/messages/read', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { messageIds, partnerId } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return ApiResponse.success(res, null, 'Nothing to mark');
  }

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      group: null,
      recipient: req.user._id,
      isRead: false,
    },
    { isRead: true, $addToSet: { readBy: { user: req.user._id, readAt: new Date() } } }
  );

  if (typeof partnerId === 'string') {
    broadcastDMRead(req.user._id.toString(), partnerId, messageIds.map(String));
  }
  ApiResponse.success(res, null, 'Marked as read');
}));

// Search DM history with a specific partner.
router.get('/dm/:userId/search', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const userId = req.params.userId as string;
  const q = (req.query.q as string || '').trim();
  if (q.length < 2) throw ApiError.badRequest('Search query must be at least 2 characters');
  const myId = req.user._id;

  const results = await Message.find({
    group: null,
    isDeleted: false,
    deletedFor: { $ne: myId },
    content: { $regex: q, $options: 'i' },
    $or: [
      { sender: myId, recipient: userId },
      { sender: userId, recipient: myId },
    ],
  })
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(50);

  ApiResponse.success(res, results);
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
  if (message.recipient) {
    broadcastDMEdit(message.sender.toString(), message.recipient.toString(), message);
  }
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
  if (message.recipient) {
    broadcastDMDelete(message.sender.toString(), message.recipient.toString(), messageId as string);
  }
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

// Edit topic — author can edit title/content, moderator+ can pin/lock
router.patch('/forum/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const topic = await ForumTopic.findOne({ _id: id, isDeleted: false });
  if (!topic) throw ApiError.notFound('Topic not found');

  const isAuthor = topic.author.toString() === (req.user._id as any).toString();
  const isMod = [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);

  // Author can edit title + content
  if (req.body.title !== undefined || req.body.content !== undefined) {
    if (!isAuthor && !isMod) throw ApiError.forbidden('Only the author can edit this topic');
    if (topic.isLocked && !isMod) throw ApiError.forbidden('This topic is locked');
    if (req.body.title) topic.title = req.body.title;
    if (req.body.content) topic.content = req.body.content;
  }

  // Moderator+ can pin/lock
  if (req.body.isPinned !== undefined || req.body.isLocked !== undefined) {
    if (!isMod) throw ApiError.forbidden('Only moderators can pin/lock topics');
    if (req.body.isPinned !== undefined) topic.isPinned = req.body.isPinned;
    if (req.body.isLocked !== undefined) topic.isLocked = req.body.isLocked;
  }

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
