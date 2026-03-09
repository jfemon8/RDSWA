import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Form } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// List submissions (Moderator+)
router.get('/', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  const [forms, total] = await Promise.all([
    Form.find(filter).populate('submittedBy', 'name email').populate('reviewedBy', 'name')
      .sort({ createdAt: -1 }).skip(getSkip({ page, limit })).limit(limit),
    Form.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, forms, total, page, limit);
}));

// My submissions
router.get('/my', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const forms = await Form.find({ submittedBy: req.user._id, isDeleted: false }).sort({ createdAt: -1 });
  ApiResponse.success(res, forms);
}));

// Get by ID
router.get('/:id', authenticate(), asyncHandler(async (req, res) => {
  const form = await Form.findOne({ _id: req.params.id, isDeleted: false })
    .populate('submittedBy', 'name email').populate('reviewedBy', 'name');
  if (!form) throw ApiError.notFound('Form not found');
  ApiResponse.success(res, form);
}));

// Submit form
router.post('/', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await Form.create({ ...req.body, submittedBy: req.user._id });
  ApiResponse.created(res, form, 'Form submitted');
}));

// Review form (approve/reject)
router.patch('/:id/review', authenticate(), authorize(UserRole.MODERATOR), auditLog('form.review', 'forms'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await Form.findOne({ _id: req.params.id, isDeleted: false });
  if (!form) throw ApiError.notFound('Form not found');
  form.status = req.body.status;
  form.reviewComment = req.body.reviewComment;
  form.reviewedBy = req.user._id as any;
  form.reviewedAt = new Date();
  await form.save();
  ApiResponse.success(res, form, `Form ${req.body.status}`);
}));

export default router;
