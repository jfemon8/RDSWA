import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { User, AuditLog, LoginHistory, Notification, Donation, Event, Form, RoleAssignment } from '../models';
import { UserRole, SUPER_ADMIN_EMAILS } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';
import { sendEmail } from '../config/mail';
import mongoose from 'mongoose';

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

// Suspicious activity alerts
router.get('/suspicious-activity', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Failed login attempts grouped by IP (more than 5 in 24h)
  const failedByIp = await LoginHistory.aggregate([
    { $match: { success: false, createdAt: { $gte: oneDayAgo } } },
    { $group: { _id: '$ip', count: { $sum: 1 }, users: { $addToSet: '$user' }, lastAttempt: { $max: '$createdAt' } } },
    { $match: { count: { $gte: 5 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  // Failed login attempts grouped by user (more than 3 in 24h)
  const failedByUser = await LoginHistory.aggregate([
    { $match: { success: false, user: { $ne: null }, createdAt: { $gte: oneDayAgo } } },
    { $group: { _id: '$user', count: { $sum: 1 }, ips: { $addToSet: '$ip' }, lastAttempt: { $max: '$createdAt' } } },
    { $match: { count: { $gte: 3 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    { $project: { count: 1, ips: 1, lastAttempt: 1, 'userInfo.name': 1, 'userInfo.email': 1 } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  // Users logging in from multiple IPs in 24h (potential account sharing)
  const multipleIps = await LoginHistory.aggregate([
    { $match: { success: true, createdAt: { $gte: oneDayAgo } } },
    { $group: { _id: '$user', ips: { $addToSet: '$ip' } } },
    { $match: { $expr: { $gte: [{ $size: '$ips' }, 3] } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    { $project: { ips: 1, 'userInfo.name': 1, 'userInfo.email': 1 } },
    { $limit: 20 },
  ]);

  ApiResponse.success(res, {
    failedByIp,
    failedByUser,
    multipleIps,
    generatedAt: new Date(),
  });
}));

// Role assignment history
router.get('/role-history', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {};
  if (req.query.userId) filter.user = req.query.userId;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.assignmentType) filter.assignmentType = req.query.assignmentType;

  const [history, total] = await Promise.all([
    RoleAssignment.find(filter)
      .populate('user', 'name email avatar')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    RoleAssignment.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, history, total, page, limit);
}));

// ─── Bulk Operations ───

// Bulk approve members
router.post('/bulk/approve', authenticate(), authorize(UserRole.MODERATOR), auditLog('admin.bulk_approve', 'users'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw ApiError.badRequest('userIds array is required');
  }

  const users = await User.find({
    _id: { $in: userIds },
    membershipStatus: 'pending',
    isDeleted: false,
  });

  let approved = 0;
  for (const target of users) {
    target.membershipStatus = 'approved';
    target.role = UserRole.MEMBER;
    target.memberApprovedBy = req.user._id as any;
    target.memberApprovedAt = new Date();
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'member_approved',
      title: 'Membership Approved',
      message: 'Your RDSWA membership has been approved!',
      link: '/dashboard',
    });
    approved++;
  }

  ApiResponse.success(res, { approved }, `${approved} members approved`);
}));

// Bulk reject members
router.post('/bulk/reject', authenticate(), authorize(UserRole.MODERATOR), auditLog('admin.bulk_reject', 'users'), asyncHandler(async (req, res) => {
  const { userIds, reason } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw ApiError.badRequest('userIds array is required');
  }

  const users = await User.find({
    _id: { $in: userIds },
    membershipStatus: 'pending',
    isDeleted: false,
  });

  let rejected = 0;
  for (const target of users) {
    target.membershipStatus = 'rejected';
    target.memberRejectionReason = reason || 'Application rejected';
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'member_rejected',
      title: 'Membership Rejected',
      message: reason || 'Your RDSWA membership application has been rejected.',
      link: '/dashboard',
    });
    rejected++;
  }

  ApiResponse.success(res, { rejected }, `${rejected} members rejected`);
}));

// Bulk email
router.post('/bulk/email', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.bulk_email', 'users'), asyncHandler(async (req, res) => {
  const { userIds, subject, body } = req.body;
  if (!subject || !body) throw ApiError.badRequest('subject and body are required');
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw ApiError.badRequest('userIds array is required');
  }

  const users = await User.find({
    _id: { $in: userIds },
    isDeleted: false,
  }).select('email name');

  let sent = 0;
  const errors: string[] = [];
  for (const user of users) {
    try {
      await sendEmail(user.email, subject, body);
      sent++;
    } catch {
      errors.push(user.email);
    }
  }

  ApiResponse.success(res, { sent, failed: errors.length, errors }, `${sent} emails sent`);
}));

// ─── Backup & Restore ───

// List all collections and their document counts
router.get('/backup/info', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');

  const collections = await db.listCollections().toArray();
  const info = await Promise.all(
    collections.map(async (col) => ({
      name: col.name,
      count: await db.collection(col.name).countDocuments(),
    }))
  );

  ApiResponse.success(res, {
    database: db.databaseName,
    collections: info.sort((a, b) => a.name.localeCompare(b.name)),
    totalCollections: info.length,
    totalDocuments: info.reduce((sum, c) => sum + c.count, 0),
  });
}));

// Export a collection as JSON
router.get('/backup/export/:collection', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.backup_export', 'system'), asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');

  const collectionName = req.params.collection as string;
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) throw ApiError.notFound('Collection not found');

  const documents = await db.collection(collectionName).find().toArray();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=${collectionName}-${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(documents, null, 2));
}));

// Restore a collection from JSON
router.post('/backup/restore/:collection', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.backup_restore', 'system'), asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');

  const collectionName = req.params.collection as string;
  const { documents, mode } = req.body;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw ApiError.badRequest('documents array is required');
  }

  const collection = db.collection(collectionName);

  if (mode === 'replace') {
    // Drop existing data and insert new
    await collection.deleteMany({});
    const result = await collection.insertMany(documents);
    ApiResponse.success(res, {
      inserted: result.insertedCount,
      mode: 'replace',
    }, `Collection ${collectionName} restored (replaced)`);
  } else {
    // Default: merge (insert, skip duplicates)
    let inserted = 0;
    let skipped = 0;
    for (const doc of documents) {
      try {
        await collection.insertOne(doc);
        inserted++;
      } catch (err: any) {
        if (err?.code === 11000) {
          skipped++; // Duplicate key
        } else {
          throw err;
        }
      }
    }
    ApiResponse.success(res, {
      inserted,
      skipped,
      mode: 'merge',
    }, `Collection ${collectionName} restored (merged)`);
  }
}));

export default router;
