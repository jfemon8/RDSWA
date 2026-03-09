import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Notification, User } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// My notifications
router.get('/', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { page, limit } = parsePagination(req.query as any);
  const filter = { recipient: req.user._id };

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    Notification.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, notifications, total, page, limit);
}));

// Mark as read
router.patch('/:id/read', authenticate(), asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user!._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notif) throw ApiError.notFound('Notification not found');
  ApiResponse.success(res, notif);
}));

// Mark all as read
router.patch('/read-all', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  ApiResponse.success(res, null, 'All notifications marked as read');
}));

// Broadcast (SuperAdmin)
router.post('/broadcast', authenticate(), authorize(UserRole.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const { title, message, link } = req.body;
  const users = await User.find({ isDeleted: false, isActive: true }).select('_id');
  const notifications = users.map((u) => ({
    recipient: u._id,
    type: 'announcement' as const,
    title,
    message,
    link,
  }));
  await Notification.insertMany(notifications);
  ApiResponse.success(res, { count: notifications.length }, 'Broadcast sent');
}));

// Targeted notification (Moderator+)
router.post('/targeted', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { recipientIds, title, message, link, type } = req.body;
  const notifications = (recipientIds as string[]).map((id) => ({
    recipient: id,
    type: type || 'system',
    title,
    message,
    link,
  }));
  await Notification.insertMany(notifications);
  ApiResponse.success(res, { count: notifications.length }, 'Notifications sent');
}));

export default router;
