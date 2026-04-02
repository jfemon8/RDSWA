import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Mentorship, Notification, User } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// Request mentorship (Member+)
router.post('/', authenticate(), authorize(UserRole.MEMBER), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { mentorId, area } = req.body;
  if (!mentorId) throw ApiError.badRequest('Mentor ID is required');

  if (mentorId === (req.user._id as any).toString()) {
    throw ApiError.badRequest('Cannot request mentorship from yourself');
  }

  const mentor = await User.findById(mentorId);
  if (!mentor) throw ApiError.notFound('Mentor not found');

  const existing = await Mentorship.findOne({
    mentor: mentorId,
    mentee: req.user._id,
    status: { $in: ['pending', 'active'] },
  });
  if (existing) throw ApiError.badRequest('You already have a pending/active mentorship with this user');

  const mentorship = await Mentorship.create({
    mentor: mentorId,
    mentee: req.user._id,
    area,
  });

  await Notification.create({
    recipient: mentorId,
    type: 'mentorship_request',
    title: 'Mentorship Request',
    message: `${req.user.name} has requested mentorship${area ? ` in ${area}` : ''}`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship requested');
}));

// List my mentorships (as mentor or mentee)
router.get('/my', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { page, limit } = parsePagination(req.query as any);
  const role = req.query.role === 'mentor' ? 'mentor' : req.query.role === 'mentee' ? 'mentee' : null;

  const filter: any = {};
  if (role === 'mentor') {
    filter.mentor = req.user._id;
  } else if (role === 'mentee') {
    filter.mentee = req.user._id;
  } else {
    filter.$or = [{ mentor: req.user._id }, { mentee: req.user._id }];
  }

  const [mentorships, total] = await Promise.all([
    Mentorship.find(filter)
      .populate('mentor', 'name avatar department batch profession')
      .populate('mentee', 'name avatar department batch profession')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Mentorship.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, mentorships, total, page, limit);
}));

// Accept mentorship (mentor only)
router.patch('/:id/accept', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const mentorship = await Mentorship.findById(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');
  if (mentorship.mentor.toString() !== (req.user._id as any).toString()) {
    throw ApiError.forbidden('Only the mentor can accept');
  }
  if (mentorship.status !== 'pending') throw ApiError.badRequest('Not in pending state');

  mentorship.status = 'active';
  mentorship.acceptedAt = new Date();
  await mentorship.save();

  await Notification.create({
    recipient: mentorship.mentee,
    type: 'mentorship_accepted',
    title: 'Mentorship Accepted',
    message: `${req.user.name} has accepted your mentorship request`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship accepted');
}));

// Complete mentorship
router.patch('/:id/complete', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const mentorship = await Mentorship.findById(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  const userId = (req.user._id as any).toString();
  if (mentorship.mentor.toString() !== userId && mentorship.mentee.toString() !== userId) {
    throw ApiError.forbidden('Not a participant');
  }
  if (mentorship.status !== 'active') throw ApiError.badRequest('Not in active state');

  mentorship.status = 'completed';
  mentorship.completedAt = new Date();
  await mentorship.save();

  ApiResponse.success(res, mentorship, 'Mentorship completed');
}));

// Cancel mentorship
router.patch('/:id/cancel', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const mentorship = await Mentorship.findById(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  const userId = (req.user._id as any).toString();
  if (mentorship.mentor.toString() !== userId && mentorship.mentee.toString() !== userId) {
    throw ApiError.forbidden('Not a participant');
  }
  if (mentorship.status === 'completed' || mentorship.status === 'cancelled') {
    throw ApiError.badRequest('Already finalized');
  }

  mentorship.status = 'cancelled';
  await mentorship.save();

  ApiResponse.success(res, mentorship, 'Mentorship cancelled');
}));

// Admin: list all mentorships
router.get('/admin/all', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {};
  if (req.query.status) filter.status = req.query.status;
  const [mentorships, total] = await Promise.all([
    Mentorship.find(filter)
      .populate('mentor', 'name avatar department')
      .populate('mentee', 'name avatar department')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Mentorship.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, mentorships, total, page, limit);
}));

// Admin: delete mentorship
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const mentorship = await Mentorship.findByIdAndDelete(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');
  ApiResponse.success(res, null, 'Mentorship deleted');
}));

// List available mentors (members with skills/profession)
router.get('/mentors', authenticate(), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {
    isDeleted: false,
    membershipStatus: 'approved',
    $or: [
      { skills: { $exists: true, $ne: [] } },
      { profession: { $exists: true, $ne: '' } },
    ],
  };

  if (req.query.area) {
    filter.skills = { $regex: req.query.area as string, $options: 'i' };
  }

  const [mentors, total] = await Promise.all([
    User.find(filter)
      .select('name avatar department batch profession skills homeDistrict')
      .sort({ name: 1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    User.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, mentors, total, page, limit);
}));

export default router;
