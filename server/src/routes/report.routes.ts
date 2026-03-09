import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { User, Donation, Event, Expense } from '../models';
import { UserRole } from '@rdswa/shared';

const router = Router();

// Member analytics
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

// Financial reports
router.get('/finance', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const [donationsByMonth, donationsByType, expensesByCategory, totalDonations, totalExpenses] = await Promise.all([
    Donation.aggregate([
      { $match: { paymentStatus: 'completed', isDeleted: false } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: '$amount' }, count: { $sum: 1 },
      }},
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]),
    Donation.aggregate([
      { $match: { paymentStatus: 'completed', isDeleted: false } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Donation.aggregate([
      { $match: { paymentStatus: 'completed', isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  ApiResponse.success(res, {
    donationsByMonth,
    donationsByType,
    expensesByCategory,
    totalDonations: totalDonations[0]?.total || 0,
    totalExpenses: totalExpenses[0]?.total || 0,
    balance: (totalDonations[0]?.total || 0) - (totalExpenses[0]?.total || 0),
  });
}));

// Event participation stats
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

// Donation trends
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

export default router;
