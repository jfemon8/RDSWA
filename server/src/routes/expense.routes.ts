import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Expense } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

router.get('/', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false };
  if (req.query.category) filter.category = req.query.category;

  const [expenses, total] = await Promise.all([
    Expense.find(filter).populate('createdBy', 'name').populate('event', 'title')
      .sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    Expense.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, expenses, total, page, limit);
}));

router.post('/', authenticate(), authorize(UserRole.ADMIN), auditLog('expense.create', 'expenses'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const expense = await Expense.create({ ...req.body, createdBy: req.user._id });
  ApiResponse.created(res, expense, 'Expense created');
}));

router.patch('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('expense.update', 'expenses'), asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true }
  );
  if (!expense) throw ApiError.notFound('Expense not found');
  ApiResponse.success(res, expense, 'Expense updated');
}));

router.delete('/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('expense.delete', 'expenses'), asyncHandler(async (req, res) => {
  await Expense.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
  ApiResponse.success(res, null, 'Expense deleted');
}));

export default router;
