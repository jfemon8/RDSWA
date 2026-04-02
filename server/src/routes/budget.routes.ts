import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Budget } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// List budgets
router.get('/', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.fiscalYear) filter.fiscalYear = req.query.fiscalYear;
  if (req.query.event) filter.event = req.query.event;

  const [budgets, total] = await Promise.all([
    Budget.find(filter)
      .populate('event', 'title')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Budget.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, budgets, total, page, limit);
}));

// Get budget by ID
router.get('/:id', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, isDeleted: false })
    .populate('event', 'title startDate')
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name');
  if (!budget) throw ApiError.notFound('Budget not found');
  ApiResponse.success(res, budget);
}));

// Create budget
router.post('/', authenticate(), authorize(UserRole.MODERATOR), auditLog('budget.create', 'budgets'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const totalAmount = (req.body.items || []).reduce((sum: number, item: any) => sum + (item.estimatedAmount || 0), 0);
  const budget = await Budget.create({
    ...req.body,
    totalAmount,
    createdBy: req.user._id,
  });
  ApiResponse.created(res, budget, 'Budget created');
}));

// Update budget
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), auditLog('budget.update', 'budgets'), asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, isDeleted: false });
  if (!budget) throw ApiError.notFound('Budget not found');
  if (budget.status === 'approved' || budget.status === 'executed') {
    throw ApiError.badRequest('Cannot edit approved/executed budget');
  }

  const { _id, __v, createdBy, createdAt, updatedAt, ...updateData } = req.body;
  Object.assign(budget, updateData);
  if (req.body.items) {
    budget.totalAmount = req.body.items.reduce((sum: number, item: any) => sum + (item.estimatedAmount || 0), 0);
  }
  await budget.save();
  ApiResponse.success(res, budget, 'Budget updated');
}));

// Approve/Reject budget (Admin+)
router.patch('/:id/review', authenticate(), authorize(UserRole.ADMIN), auditLog('budget.review', 'budgets'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const budget = await Budget.findOne({ _id: req.params.id, isDeleted: false });
  if (!budget) throw ApiError.notFound('Budget not found');

  if (req.body.status === 'approved') {
    budget.status = 'approved';
    budget.approvedBy = req.user._id as any;
    budget.approvedAt = new Date();
  } else if (req.body.status === 'rejected') {
    budget.status = 'rejected';
    budget.rejectionReason = req.body.rejectionReason || '';
  }

  await budget.save();
  ApiResponse.success(res, budget, `Budget ${req.body.status}`);
}));

// Update actual amounts (mark executed)
router.patch('/:id/execute', authenticate(), authorize(UserRole.ADMIN), auditLog('budget.execute', 'budgets'), asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, isDeleted: false });
  if (!budget) throw ApiError.notFound('Budget not found');
  if (budget.status !== 'approved') throw ApiError.badRequest('Budget must be approved first');

  if (req.body.items) {
    for (const item of req.body.items) {
      const budgetItem = budget.items.find((_i, idx) => idx === item.index);
      if (budgetItem && item.actualAmount !== undefined) {
        budgetItem.actualAmount = item.actualAmount;
      }
    }
  }
  budget.status = 'executed';
  await budget.save();
  ApiResponse.success(res, budget, 'Budget executed');
}));

// Delete budget
router.delete('/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('budget.delete', 'budgets'), asyncHandler(async (req, res) => {
  await Budget.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
  ApiResponse.success(res, null, 'Budget deleted');
}));

export default router;
