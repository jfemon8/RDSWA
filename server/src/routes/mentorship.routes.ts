import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Mentorship, Notification, User, ChatGroup } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// ─── Helpers ───

/**
 * Ensure a consultation group exists for a mentor. Creates one on first active
 * mentee. Name: "{MentorName}'s Consultation". Mentor is creator + admin.
 */
async function ensureConsultationGroup(mentorId: string, mentorName: string) {
  let group = await ChatGroup.findOne({
    type: 'consultation',
    mentorUser: mentorId,
    isDeleted: false,
  });
  if (!group) {
    group = await ChatGroup.create({
      name: `${mentorName}'s Consultation`,
      description: `Mentorship consultation group managed by ${mentorName}`,
      type: 'consultation',
      mentorUser: mentorId,
      members: [mentorId],
      admins: [mentorId],
      createdBy: mentorId,
    });
  }
  return group;
}

/** Add a mentee to the mentor's consultation group */
async function addToConsultationGroup(mentorId: string, mentorName: string, menteeId: string) {
  const group = await ensureConsultationGroup(mentorId, mentorName);
  await ChatGroup.findByIdAndUpdate(group._id, {
    $addToSet: { members: menteeId },
  });
}

/** Remove a mentee from the mentor's consultation group (if no other active mentorship) */
async function removeFromConsultationGroup(mentorId: string, menteeId: string) {
  // Check if mentee has any other active mentorships with this mentor
  const otherActive = await Mentorship.findOne({
    mentor: mentorId,
    mentee: menteeId,
    status: 'active',
  });
  if (otherActive) return; // Still has active mentorship, keep in group

  const group = await ChatGroup.findOne({
    type: 'consultation',
    mentorUser: mentorId,
    isDeleted: false,
  });
  if (!group) return;

  await ChatGroup.findByIdAndUpdate(group._id, {
    $pull: { members: menteeId },
  });

  // If no active mentees left (only mentor), soft-delete the group
  const updated = await ChatGroup.findById(group._id);
  if (updated && updated.members.length <= 1) {
    updated.isDeleted = true;
    await updated.save();
  }
}

// ─── Routes ───

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

  if (!mentor.isAlumni && !mentor.isAdvisor && !mentor.isSeniorAdvisor) {
    throw ApiError.badRequest('Only Alumni, Advisors, or Senior Advisors can be mentors');
  }

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
    title: 'New Mentorship Request',
    message: `${req.user.name} has requested mentorship${area ? ` in "${area}"` : ''}`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship requested');
}));

// List my mentorships — includes contact info for active mentorships
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
      .populate('mentor', 'name avatar department batch profession email phone')
      .populate('mentee', 'name avatar department batch profession email phone')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Mentorship.countDocuments(filter),
  ]);

  // Only expose email/phone for active mentorships (mutual contact sharing)
  const userId = (req.user._id as any).toString();
  const sanitized = mentorships.map((m) => {
    const obj: any = m.toObject();
    if (obj.status !== 'active') {
      // Strip contact info for non-active mentorships
      if (obj.mentor) { delete obj.mentor.email; delete obj.mentor.phone; }
      if (obj.mentee) { delete obj.mentee.email; delete obj.mentee.phone; }
    }
    return obj;
  });

  ApiResponse.paginated(res, sanitized, total, page, limit);
}));

// Accept mentorship → activate + add to consultation group + notify
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

  // Add mentee to consultation group
  await addToConsultationGroup(
    mentorship.mentor.toString(),
    req.user.name,
    mentorship.mentee.toString()
  );

  await Notification.create({
    recipient: mentorship.mentee,
    type: 'mentorship_accepted',
    title: 'Mentorship Accepted!',
    message: `${req.user.name} has accepted your mentorship request. You can now see their contact info and have been added to their consultation group.`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship accepted');
}));

// Complete mentorship → remove from group + revoke contact
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

  // Remove mentee from consultation group
  await removeFromConsultationGroup(
    mentorship.mentor.toString(),
    mentorship.mentee.toString()
  );

  // Notify the other party
  const recipientId = mentorship.mentor.toString() === userId
    ? mentorship.mentee : mentorship.mentor;
  await Notification.create({
    recipient: recipientId,
    type: 'general',
    title: 'Mentorship Completed',
    message: `${req.user.name} has marked your mentorship as completed.`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship completed');
}));

// Cancel mentorship → remove from group + revoke contact
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

  const wasActive = mentorship.status === 'active';
  mentorship.status = 'cancelled';
  await mentorship.save();

  // If was active, remove mentee from consultation group
  if (wasActive) {
    await removeFromConsultationGroup(
      mentorship.mentor.toString(),
      mentorship.mentee.toString()
    );
  }

  // Notify the other party
  const recipientId = mentorship.mentor.toString() === userId
    ? mentorship.mentee : mentorship.mentor;
  await Notification.create({
    recipient: recipientId,
    type: 'general',
    title: 'Mentorship Cancelled',
    message: `${req.user.name} has cancelled the mentorship.`,
    link: '/dashboard/mentorship',
  });

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

// Admin: delete mentorship (also clean up group)
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const mentorship = await Mentorship.findById(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');

  if (mentorship.status === 'active') {
    await removeFromConsultationGroup(
      mentorship.mentor.toString(),
      mentorship.mentee.toString()
    );
  }

  await Mentorship.findByIdAndDelete(mentorship._id);
  ApiResponse.success(res, null, 'Mentorship deleted');
}));

// List available mentors (Alumni, Advisors, or Senior Advisors)
router.get('/mentors', authenticate(), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = {
    isDeleted: false,
    membershipStatus: 'approved',
    $or: [
      { isAlumni: true },
      { isAdvisor: true },
      { isSeniorAdvisor: true },
    ],
  };

  if (req.query.area) {
    filter.skills = { $regex: req.query.area as string, $options: 'i' };
  }

  const [mentors, total] = await Promise.all([
    User.find(filter)
      .select('name avatar department batch profession skills homeDistrict isAlumni isAdvisor isSeniorAdvisor')
      .sort({ name: 1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    User.countDocuments(filter),
  ]);

  // Count active mentees for each mentor
  const mentorIds = mentors.map((m) => m._id);
  const menteeCounts = await Mentorship.aggregate([
    { $match: { mentor: { $in: mentorIds }, status: 'active' } },
    { $group: { _id: '$mentor', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(menteeCounts.map((c: any) => [c._id.toString(), c.count]));

  const enriched = mentors.map((m) => ({
    ...m.toObject(),
    activeMentees: countMap.get(m._id.toString()) || 0,
  }));

  ApiResponse.paginated(res, enriched, total, page, limit);
}));

export default router;
