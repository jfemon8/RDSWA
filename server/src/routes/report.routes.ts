import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { User, Donation, Event, Expense, Budget } from '../models';
import { UserRole } from '@rdswa/shared';
import mongoose from 'mongoose';

const router = Router();

// ─── Member analytics ───
router.get('/members', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const [byRole, byBatch, byDepartment, byDistrict] = await Promise.all([
    User.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { isDeleted: false, batch: { $exists: true } } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { isDeleted: false, department: { $exists: true, $ne: '' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $match: { isDeleted: false, homeDistrict: { $exists: true, $ne: '' } } },
      { $group: { _id: '$homeDistrict', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  ApiResponse.success(res, { byRole, byBatch, byDepartment, byDistrict });
}));

// ─── Financial reports (enhanced) ───
router.get('/finance', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const yearFilter = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

  const donationMatch: any = { paymentStatus: 'completed', isDeleted: false };
  const expenseMatch: any = { isDeleted: false };

  if (yearFilter) {
    const start = new Date(yearFilter, 0, 1);
    const end = new Date(yearFilter + 1, 0, 1);
    donationMatch.createdAt = { $gte: start, $lt: end };
    expenseMatch.createdAt = { $gte: start, $lt: end };
  }

  const [donationsByMonth, donationsByType, expensesByCategory, totalDonations, totalExpenses, donationsByYear] = await Promise.all([
    Donation.aggregate([
      { $match: donationMatch },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$amount' }, count: { $sum: 1 },
      }},
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 24 },
    ]),
    Donation.aggregate([
      { $match: donationMatch },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Donation.aggregate([
      { $match: donationMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // Yearly totals
    Donation.aggregate([
      { $match: { paymentStatus: 'completed', isDeleted: false } },
      { $group: {
        _id: { $year: '$createdAt' },
        total: { $sum: '$amount' }, count: { $sum: 1 },
      }},
      { $sort: { _id: -1 } },
    ]),
  ]);

  ApiResponse.success(res, {
    donationsByMonth,
    donationsByType,
    expensesByCategory,
    donationsByYear,
    totalDonations: totalDonations[0]?.total || 0,
    totalExpenses: totalExpenses[0]?.total || 0,
    balance: (totalDonations[0]?.total || 0) - (totalExpenses[0]?.total || 0),
  });
}));

// ─── Event-based finance report ───
router.get('/finance/events', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const [eventExpenses, eventBudgets] = await Promise.all([
    Expense.aggregate([
      { $match: { isDeleted: false, event: { $exists: true } } },
      { $group: {
        _id: '$event',
        totalExpense: { $sum: '$amount' },
        count: { $sum: 1 },
      }},
      { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'eventInfo' } },
      { $unwind: '$eventInfo' },
      { $project: {
        _id: 1,
        totalExpense: 1,
        count: 1,
        eventTitle: '$eventInfo.title',
        eventDate: '$eventInfo.startDate',
      }},
      { $sort: { eventDate: -1 } },
    ]),
    Budget.aggregate([
      { $match: { isDeleted: false, event: { $exists: true } } },
      { $group: {
        _id: '$event',
        totalBudget: { $sum: '$totalAmount' },
        status: { $first: '$status' },
      }},
      { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'eventInfo' } },
      { $unwind: '$eventInfo' },
      { $project: {
        _id: 1,
        totalBudget: 1,
        status: 1,
        eventTitle: '$eventInfo.title',
      }},
    ]),
  ]);

  // Merge event expenses with budgets
  const eventMap = new Map();
  for (const e of eventExpenses) {
    eventMap.set(e._id.toString(), { ...e, totalBudget: 0 });
  }
  for (const b of eventBudgets) {
    const key = b._id.toString();
    if (eventMap.has(key)) {
      eventMap.get(key).totalBudget = b.totalBudget;
    } else {
      eventMap.set(key, { ...b, totalExpense: 0, count: 0 });
    }
  }

  ApiResponse.success(res, Array.from(eventMap.values()));
}));

// ─── Event participation stats ───
router.get('/events', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const stats = await Event.aggregate([
    { $match: { isDeleted: false } },
    { $group: {
      _id: '$type',
      count: { $sum: 1 },
      avgAttendance: { $avg: { $size: '$attendance' } },
      totalRegistered: { $sum: { $size: '$registeredUsers' } },
    }},
  ]);
  ApiResponse.success(res, stats);
}));

// ─── Donation trends ───
router.get('/donations', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const trends = await Donation.aggregate([
    { $match: { paymentStatus: 'completed', isDeleted: false } },
    { $group: {
      _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
      total: { $sum: '$amount' },
      count: { $sum: 1 },
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);
  ApiResponse.success(res, trends);
}));

// ─── Export finance data as CSV ───
router.get('/finance/export', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const type = (req.query.type as string) || 'donations';
  const yearFilter = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

  if (type === 'donations') {
    const match: any = { paymentStatus: 'completed', isDeleted: false };
    if (yearFilter) {
      match.createdAt = { $gte: new Date(yearFilter, 0, 1), $lt: new Date(yearFilter + 1, 0, 1) };
    }
    const donations = await Donation.find(match)
      .populate('donor', 'name email')
      .populate('campaign', 'title')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Receipt,Date,Donor,Email,Amount,Type,Method,Transaction ID,Sender Number,Campaign,Visibility\n';
    const rows = donations.map((d: any) =>
      `${d.receiptNumber || ''},${new Date(d.createdAt).toISOString().slice(0, 10)},${(d.donor?.name || d.donorName || 'Anonymous').replace(/,/g, '')},${d.donor?.email || d.donorEmail || ''},${d.amount},${d.type},${d.paymentMethod},${d.transactionId || ''},${d.senderNumber || ''},${(d.campaign?.title || '').replace(/,/g, '')},${d.visibility}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=donations-${yearFilter || 'all'}.csv`);
    res.send(header + rows);
  } else if (type === 'expenses') {
    const match: any = { isDeleted: false };
    if (yearFilter) {
      match.createdAt = { $gte: new Date(yearFilter, 0, 1), $lt: new Date(yearFilter + 1, 0, 1) };
    }
    const expenses = await Expense.find(match)
      .populate('event', 'title')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Date,Title,Amount,Category,Event,Created By,Receipt\n';
    const rows = expenses.map((e: any) =>
      `${new Date(e.createdAt).toISOString().slice(0, 10)},${e.title.replace(/,/g, '')},${e.amount},${e.category},${(e.event?.title || '').replace(/,/g, '')},${(e.createdBy?.name || '').replace(/,/g, '')},${e.receiptUrl || ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expenses-${yearFilter || 'all'}.csv`);
    res.send(header + rows);
  } else {
    throw ApiError.badRequest('Invalid export type. Use "donations" or "expenses".');
  }
}));

// ─── Published Reports (approval workflow) ───
// Reports can be generated and published by admin. We'll use a lightweight
// approach: save report snapshots in-memory via a simple collection.

// Create a report snapshot for publishing
router.post('/publish', authenticate(), authorize(UserRole.ADMIN), auditLog('report.publish', 'reports'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { title, type, data, fiscalYear } = req.body;
  if (!title || !type) throw ApiError.badRequest('title and type required');

  // Store in a generic collection
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');
  const result = await db.collection('published_reports').insertOne({
    title,
    type, // 'finance', 'members', 'events', 'donations'
    data: data || {},
    fiscalYear,
    status: 'draft',
    publishedBy: req.user._id,
    publishedAt: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
  });

  ApiResponse.created(res, { _id: result.insertedId }, 'Report draft created');
}));

// Approve and publish a report (SuperAdmin)
router.patch('/publish/:id/approve', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('report.approve', 'reports'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');
  const result = await db.collection('published_reports').findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(req.params.id as string) },
    { $set: { status: 'published', approvedBy: req.user._id, approvedAt: new Date(), publishedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) throw ApiError.notFound('Report not found');
  ApiResponse.success(res, result, 'Report published');
}));

// List published reports
router.get('/published', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (_req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database not connected');
  const reports = await db.collection('published_reports').find().sort({ createdAt: -1 }).toArray();
  ApiResponse.success(res, reports);
}));

export default router;
