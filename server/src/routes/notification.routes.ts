import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Notification, User } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';
import { notificationService } from '../services/notification.service';
import { PushSubscription } from '../config/webpush';
import { env } from '../config/env';

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

// Unread count
router.get('/unread-count', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  ApiResponse.success(res, { count });
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

// Broadcast (SuperAdmin) — uses centralized service with preferences
router.post('/broadcast', authenticate(), authorize(UserRole.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const { title, message, link } = req.body;
  const users = await User.find({ isDeleted: false, isActive: true }).select('_id');
  const recipientIds = users.map((u) => u._id);
  const count = await notificationService.sendBulk({
    recipientIds,
    type: 'announcement',
    title,
    message,
    link,
    force: true, // Broadcasts bypass DND
  });
  ApiResponse.success(res, { count }, 'Broadcast sent');
}));

// Targeted notification (Moderator+) — uses centralized service
router.post('/targeted', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { recipientIds, title, message, link, type } = req.body;
  const count = await notificationService.sendBulk({
    recipientIds,
    type: type || 'system',
    title,
    message,
    link,
  });
  ApiResponse.success(res, { count }, 'Notifications sent');
}));

// ── Push Subscription Endpoints ──

// Get VAPID public key
router.get('/push/vapid-key', authenticate(), asyncHandler(async (_req, res) => {
  ApiResponse.success(res, { publicKey: env.VAPID_PUBLIC_KEY || null });
}));

// Subscribe to push notifications
router.post('/push/subscribe', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw ApiError.badRequest('Invalid push subscription data');
  }

  await PushSubscription.findOneAndUpdate(
    { user: req.user._id, endpoint },
    { user: req.user._id, endpoint, keys },
    { upsert: true, new: true }
  );
  ApiResponse.success(res, null, 'Push subscription saved');
}));

// Unsubscribe from push notifications
router.delete('/push/unsubscribe', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { endpoint } = req.body;
  if (endpoint) {
    await PushSubscription.deleteOne({ user: req.user._id, endpoint });
  } else {
    await PushSubscription.deleteMany({ user: req.user._id });
  }
  ApiResponse.success(res, null, 'Push subscription removed');
}));

// ── Notification Preferences ──

// Get my notification preferences
router.get('/preferences', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user._id).select('notificationPrefs').lean();
  const prefs = user?.notificationPrefs || {
    email: true, sms: false, push: true, inApp: true,
    digestFrequency: 'daily', dnd: false,
  };
  ApiResponse.success(res, prefs);
}));

// Update my notification preferences
router.patch('/preferences', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const allowed = ['email', 'sms', 'push', 'inApp', 'digestFrequency', 'dnd'];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      update[`notificationPrefs.${key}`] = req.body[key];
    }
  }
  if (Object.keys(update).length === 0) {
    throw ApiError.badRequest('No valid preference fields provided');
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true })
    .select('notificationPrefs');
  ApiResponse.success(res, user?.notificationPrefs);
}));

export default router;
