import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Form, User, Notification } from '../models';
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
    Form.find(filter).populate('submittedBy', 'name email membershipStatus').populate('reviewedBy', 'name')
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

  // For membership applications, check and update user status
  if (req.body.type === 'membership') {
    const user = await User.findById(req.user._id);
    if (!user) throw ApiError.notFound('User not found');

    if (user.membershipStatus === 'approved') {
      throw ApiError.badRequest('You are already an approved member');
    }
    if (user.membershipStatus === 'pending') {
      throw ApiError.badRequest('You already have a pending membership application');
    }

    // Set membership status to pending
    user.membershipStatus = 'pending';
    await user.save();
  }

  const form = await Form.create({ ...req.body, submittedBy: req.user._id });
  ApiResponse.created(res, form, 'Form submitted');
}));

// Review form (approve/reject)
router.patch('/:id/review', authenticate(), authorize(UserRole.MODERATOR), auditLog('form.review', 'forms'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const form = await Form.findOne({ _id: req.params.id as string, isDeleted: false });
  if (!form) throw ApiError.notFound('Form not found');

  form.status = req.body.status;
  form.reviewComment = req.body.reviewComment;
  form.reviewedBy = req.user._id as any;
  form.reviewedAt = new Date();
  await form.save();

  // For membership forms, sync with user membership status
  if (form.type === 'membership') {
    const applicant = await User.findById(form.submittedBy);
    if (applicant) {
      if (req.body.status === 'approved') {
        applicant.membershipStatus = 'approved';
        applicant.role = UserRole.MEMBER;
        applicant.memberApprovedBy = req.user._id as any;
        applicant.memberApprovedAt = new Date();
        await applicant.save();

        await Notification.create({
          recipient: applicant._id,
          type: 'member_approved',
          title: 'Membership Approved',
          message: 'Your RDSWA membership has been approved!',
          link: '/dashboard',
        });
      } else if (req.body.status === 'rejected') {
        applicant.membershipStatus = 'rejected';
        applicant.memberRejectionReason = req.body.reviewComment || 'Application rejected';
        await applicant.save();

        await Notification.create({
          recipient: applicant._id,
          type: 'member_rejected',
          title: 'Membership Rejected',
          message: req.body.reviewComment || 'Your RDSWA membership application has been rejected.',
          link: '/dashboard',
        });
      }
    }
  }

  ApiResponse.success(res, form, `Form ${req.body.status}`);
}));

export default router;
