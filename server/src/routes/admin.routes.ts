import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { User, AuditLog, LoginHistory, Notification, Donation, Event, Form } from '../models';
import { UserRole, SUPER_ADMIN_EMAILS } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// Dashboard stats
router.get('/dashboard', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const [
    totalUsers,
    pendingMembers,
    approvedMembers,
    totalEvents,
    totalDonations,
    pendingForms,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    User.countDocuments({ membershipStatus: 'pending', isDeleted: false }),
    User.countDocuments({ membershipStatus: 'approved', isDeleted: false }),
    Event.countDocuments({ isDeleted: false }),
    Donation.aggregate([
      { $match: { paymentStatus: 'completed', isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Form.countDocuments({ status: 'pending', isDeleted: false }),
  ]);

  ApiResponse.success(res, {
    totalUsers,
    pendingMembers,
    approvedMembers,
    totalEvents,
    totalDonationsAmount: totalDonations[0]?.total || 0,
    pendingForms,
  });
}));

// List moderators
router.get('/moderators', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const moderators = await User.find({ isModerator: true, isDeleted: false })
    .select('name email avatar role moderatorAssignment');
  ApiResponse.success(res, moderators);
}));

// Assign moderator
router.post('/moderators/:userId', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.assign_moderator', 'users'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  target.isModerator = true;
  if (target.role !== UserRole.ADMIN && target.role !== UserRole.SUPER_ADMIN) {
    target.role = UserRole.MODERATOR;
  }
  target.moderatorAssignment = {
    type: 'manual',
    reason: req.body.reason || 'manual_assignment',
    assignedBy: req.user._id as any,
    assignedAt: new Date(),
  };
  await target.save();
  ApiResponse.success(res, target, 'Moderator assigned');
}));

// Remove moderator
router.delete('/moderators/:userId', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.remove_moderator', 'users'), asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  target.isModerator = false;
  target.moderatorAssignment = undefined;
  if (target.role === UserRole.MODERATOR) {
    target.role = target.membershipStatus === 'approved' ? UserRole.MEMBER : UserRole.USER;
  }
  await target.save();
  ApiResponse.success(res, target, 'Moderator removed');
}));

// List admins (SuperAdmin only)
router.get('/admins', authenticate(), authorize(UserRole.SUPER_ADMIN), asyncHandler(async (_req, res) => {
  const admins = await User.find({
    role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    isDeleted: false,
  }).select('name email avatar role');
  ApiResponse.success(res, admins);
}));

// Promote to admin
router.post('/admins/:userId', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('admin.promote', 'users'), asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  if (SUPER_ADMIN_EMAILS.includes(target.email)) throw ApiError.badRequest('Cannot modify SuperAdmin');
  target.role = UserRole.ADMIN;
  await target.save();
  ApiResponse.success(res, target, 'User promoted to Admin');
}));

// Demote admin
router.delete('/admins/:userId', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('admin.demote', 'users'), asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  if (SUPER_ADMIN_EMAILS.includes(target.email)) throw ApiError.badRequest('Cannot modify SuperAdmin');
  target.role = target.membershipStatus === 'approved' ? UserRole.MEMBER : UserRole.USER;
  await target.save();
  ApiResponse.success(res, target, 'Admin demoted');
}));

// Audit logs
router.get('/logs', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.resource) filter.resource = req.query.resource;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email')
      .sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, logs, total, page, limit);
}));

// Login history
router.get('/login-history', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {};
  if (req.query.userId) filter.user = req.query.userId;

  const [history, total] = await Promise.all([
    LoginHistory.find(filter).populate('user', 'name email')
      .sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    LoginHistory.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, history, total, page, limit);
}));

export default router;
