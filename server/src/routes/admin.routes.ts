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
import { resolveBaseRole } from '../utils/resolveBaseRole';
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
  const previousRole = target.role;
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

  await RoleAssignment.create({
    user: target._id,
    role: UserRole.MODERATOR,
    previousRole,
    assignmentType: 'manual',
    reason: req.body.reason || 'manual_assignment',
    assignedBy: req.user._id,
  });

  await Notification.create({
    recipient: target._id,
    type: 'role_changed',
    title: 'Moderator Role Assigned',
    message: `You have been assigned the Moderator role by an admin.`,
    link: '/dashboard',
  });

  ApiResponse.success(res, target, 'Moderator assigned');
}));

// Remove moderator
router.delete('/moderators/:userId', authenticate(), authorize(UserRole.ADMIN), auditLog('admin.remove_moderator', 'users'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  const previousRole = target.role;
  target.isModerator = false;
  target.moderatorAssignment = undefined;
  if (target.role === UserRole.MODERATOR) {
    target.role = resolveBaseRole(target);
  }
  await target.save();

  await RoleAssignment.create({
    user: target._id,
    role: target.role,
    previousRole,
    assignmentType: 'manual',
    reason: 'moderator_removed_by_admin',
    assignedBy: req.user._id,
  });

  await Notification.create({
    recipient: target._id,
    type: 'role_changed',
    title: 'Moderator Role Removed',
    message: `Your Moderator role has been removed. Your role is now ${target.role.replace(/_/g, ' ')}.`,
    link: '/dashboard',
  });

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
  if (!req.user) throw ApiError.unauthorized();
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  if (SUPER_ADMIN_EMAILS.includes(target.email)) throw ApiError.badRequest('Cannot modify SuperAdmin');
  const previousRole = target.role;
  target.role = UserRole.ADMIN;
  await target.save();

  await RoleAssignment.create({
    user: target._id,
    role: UserRole.ADMIN,
    previousRole,
    assignmentType: 'manual',
    reason: 'promoted_to_admin',
    assignedBy: req.user._id,
  });

  await Notification.create({
    recipient: target._id,
    type: 'role_changed',
    title: 'Promoted to Admin',
    message: 'You have been promoted to Admin by a SuperAdmin.',
    link: '/dashboard',
  });

  ApiResponse.success(res, target, 'User promoted to Admin');
}));

// Demote admin
router.delete('/admins/:userId', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('admin.demote', 'users'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const target = await User.findById(req.params.userId);
  if (!target) throw ApiError.notFound('User not found');
  if (SUPER_ADMIN_EMAILS.includes(target.email)) throw ApiError.badRequest('Cannot modify SuperAdmin');
  const previousRole = target.role;
  // If user is also a moderator, fall back to moderator; otherwise resolve base role
  if (target.isModerator) {
    target.role = UserRole.MODERATOR;
  } else {
    target.role = resolveBaseRole(target);
  }
  await target.save();

  await RoleAssignment.create({
    user: target._id,
    role: target.role,
    previousRole,
    assignmentType: 'manual',
    reason: 'admin_demoted',
    assignedBy: req.user._id,
  });

  await Notification.create({
    recipient: target._id,
    type: 'role_changed',
    title: 'Admin Role Removed',
    message: `Your Admin role has been removed. Your role is now ${target.role.replace(/_/g, ' ')}.`,
    link: '/dashboard',
  });

  ApiResponse.success(res, target, 'Admin demoted');
}));

// Resource collection → model name field mapping for resolving IDs to names
const RESOURCE_NAME_FIELDS: Record<string, { collection: string; field: string }> = {
  users: { collection: 'users', field: 'name' },
  committees: { collection: 'committees', field: 'name' },
  events: { collection: 'events', field: 'title' },
  notices: { collection: 'notices', field: 'title' },
  forms: { collection: 'forms', field: 'type' },
  documents: { collection: 'documents', field: 'title' },
  albums: { collection: 'albums', field: 'title' },
  site_settings: { collection: 'sitesettings', field: 'siteName' },
  votes: { collection: 'votes', field: 'title' },
  donations: { collection: 'donations', field: 'receiptNumber' },
  expenses: { collection: 'expenses', field: 'title' },
  budgets: { collection: 'budgets', field: 'title' },
  reports: { collection: 'published_reports', field: 'title' },
  system: { collection: '', field: '' },
};

// Audit logs
router.get('/logs', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {};
  if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };
  if (req.query.resource) filter.resource = { $regex: req.query.resource, $options: 'i' };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name email avatar')
      .sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  // Resolve resourceId → readable name/title
  const db = mongoose.connection.db;
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      const obj: any = log.toObject();
      if (obj.resourceId && db) {
        const mapping = RESOURCE_NAME_FIELDS[obj.resource];
        if (mapping?.collection) {
          try {
            const doc = await db.collection(mapping.collection).findOne(
              { _id: new mongoose.Types.ObjectId(obj.resourceId) },
              { projection: { [mapping.field]: 1 } }
            );
            if (doc) {
              obj.resourceName = doc[mapping.field] || String(obj.resourceId);
            }
          } catch {}
        }
      }
      return obj;
    })
  );

  ApiResponse.paginated(res, enrichedLogs, total, page, limit);
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
