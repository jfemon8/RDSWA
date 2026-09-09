import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Mentorship, Notification, User, ChatGroup } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';
import { auditLog } from '../middlewares/audit.middleware';
import { getMentorshipConfig } from '../utils/getMentorshipConfig';
import { classifyMentorAreas, effectiveMentorAreas } from '../utils/classifyMentorAreas';

const router = Router();

const MENTORSHIP_STATUSES = ['pending', 'active', 'completed', 'cancelled'];

/** Ensure a mentor's consultation group exists, creating it on the first active mentee with the mentor as creator and admin. */
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

  // The group has no reason to exist once the last mentee leaves.
  const updated = await ChatGroup.findById(group._id);
  if (updated && updated.members.length <= 1) {
    updated.isDeleted = true;
    await updated.save();
  }
}

/** The figure the capacity rule is measured against. */
async function activeMenteeCount(mentorId: string): Promise<number> {
  return Mentorship.countDocuments({ mentor: mentorId, status: 'active' });
}

/** Rejects a pairing that would push a mentor past the configured cap, which 0 disables. */
async function assertMentorHasRoom(mentorId: string): Promise<void> {
  const { maxActiveMentees } = await getMentorshipConfig();
  if (!maxActiveMentees) return;
  const current = await activeMenteeCount(mentorId);
  if (current >= maxActiveMentees) {
    throw ApiError.badRequest(`This mentor already has ${current} active mentees, which is the current limit`);
  }
}

/** The ids of users whose name or email matches, so admin search can reach through the populated fields. */
async function matchingUserIds(search: string): Promise<any[]> {
  const users = await User.find({
    isDeleted: false,
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ],
  }).select('_id').lean();
  return users.map((u) => u._id);
}

/** Filter for the admin list, shared by the table, the stats and the export so all three agree. */
async function buildAdminFilter(query: any): Promise<Record<string, any>> {
  const filter: Record<string, any> = {};
  if (query.status) filter.status = query.status;
  if (query.area) filter.area = query.area;
  if (query.mentor) filter.mentor = query.mentor;
  if (query.mentee) filter.mentee = query.mentee;
  if (query.search) {
    const ids = await matchingUserIds(query.search as string);
    filter.$or = [{ mentor: { $in: ids } }, { mentee: { $in: ids } }];
  }
  return filter;
}

// ─── Routes ───

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
  if (mentor.isMentor === false) throw ApiError.badRequest('This member has paused their mentor listing');

  await assertMentorHasRoom(mentorId);

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
  // Lets a caller count one status without pulling the whole list, which the pending badge relies on.
  if (typeof req.query.status === 'string' && MENTORSHIP_STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [mentorships, total] = await Promise.all([
    Mentorship.find(filter)
      .populate('mentor', 'name avatar department batch profession email phone mentorAreas')
      .populate('mentee', 'name avatar department batch profession email phone')
      .populate('closedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Mentorship.countDocuments(filter),
  ]);

  // Only expose email/phone for active mentorships (mutual contact sharing)
  const sanitized = mentorships.map((m) => {
    const obj: any = m.toObject();
    if (obj.status !== 'active') {
      if (obj.mentor) { delete obj.mentor.email; delete obj.mentor.phone; }
      if (obj.mentee) { delete obj.mentee.email; delete obj.mentee.phone; }
    }
    return obj;
  });

  // The consultation group lives on the mentor, so an active pairing can link straight into it.
  const activeMentorIds = [
    ...new Set(
      sanitized
        .filter((m) => m.status === 'active')
        .map((m) => m.mentor?._id?.toString())
        .filter(Boolean),
    ),
  ];
  if (activeMentorIds.length > 0) {
    const groups = await ChatGroup.find({
      type: 'consultation',
      mentorUser: { $in: activeMentorIds },
      isDeleted: false,
    }).select('_id mentorUser').lean();
    const groupMap = new Map(groups.map((g: any) => [g.mentorUser.toString(), g._id]));
    sanitized.forEach((m) => {
      if (m.status === 'active') {
        m.consultationGroupId = groupMap.get(m.mentor?._id?.toString()) || null;
      }
    });
  }

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

  await assertMentorHasRoom(mentorship.mentor.toString());

  mentorship.status = 'active';
  mentorship.acceptedAt = new Date();
  await mentorship.save();

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

  await removeFromConsultationGroup(
    mentorship.mentor.toString(),
    mentorship.mentee.toString()
  );

  const recipientId = mentorship.mentor.toString() === userId
    ? mentorship.mentee : mentorship.mentor;
  await Notification.create({
    recipient: recipientId,
    type: 'mentorship_completed',
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

  if (wasActive) {
    await removeFromConsultationGroup(
      mentorship.mentor.toString(),
      mentorship.mentee.toString()
    );
  }

  const recipientId = mentorship.mentor.toString() === userId
    ? mentorship.mentee : mentorship.mentor;
  await Notification.create({
    recipient: recipientId,
    type: 'mentorship_cancelled',
    title: 'Mentorship Cancelled',
    message: `${req.user.name} has cancelled the mentorship.`,
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, mentorship, 'Mentorship cancelled');
}));

// Admin: list all mentorships — readable by Moderator+, since acting on them stays Admin-only
router.get('/admin/all', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter = await buildAdminFilter(req.query);

  const [mentorships, total] = await Promise.all([
    Mentorship.find(filter)
      .populate('mentor', 'name avatar department batch profession')
      .populate('mentee', 'name avatar department batch')
      .populate('closedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    Mentorship.countDocuments(filter),
  ]);

  // Each active pairing has a consultation group, which the panel links to rather than hunting for.
  const mentorIds = mentorships.filter((m) => m.status === 'active').map((m) => m.mentor);
  const groups = mentorIds.length
    ? await ChatGroup.find({ type: 'consultation', mentorUser: { $in: mentorIds }, isDeleted: false })
        .select('_id mentorUser').lean()
    : [];
  const groupMap = new Map(groups.map((g: any) => [g.mentorUser.toString(), g._id.toString()]));

  const enriched = mentorships.map((m) => ({
    ...m.toObject(),
    consultationGroup: m.status === 'active' ? groupMap.get((m.mentor as any)?._id?.toString()) || null : null,
  }));

  ApiResponse.paginated(res, enriched, total, page, limit);
}));

// Admin: programme health at a glance — counts by status, stalled requests and busiest mentors
router.get('/admin/stats', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (_req, res) => {
  const { staleRequestDays, maxActiveMentees } = await getMentorshipConfig();
  const staleBefore = new Date(Date.now() - staleRequestDays * 24 * 60 * 60 * 1000);

  const [byStatus, stalePending, topMentors, mentorCount] = await Promise.all([
    Mentorship.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Mentorship.countDocuments({ status: 'pending', requestedAt: { $lt: staleBefore } }),
    Mentorship.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$mentor', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'mentor' } },
      { $unwind: '$mentor' },
      { $project: { _id: 1, count: 1, name: '$mentor.name', avatar: '$mentor.avatar' } },
    ]),
    User.countDocuments({ isDeleted: false, isMentor: true }),
  ]);

  const counts = Object.fromEntries(byStatus.map((r: any) => [r._id, r.count]));
  ApiResponse.success(res, {
    pending: counts.pending || 0,
    active: counts.active || 0,
    completed: counts.completed || 0,
    cancelled: counts.cancelled || 0,
    total: byStatus.reduce((sum: number, r: any) => sum + r.count, 0),
    stalePending,
    staleRequestDays,
    maxActiveMentees,
    mentorCount,
    topMentors,
  });
}));

// Admin: mentor roster with the load each one is carrying
router.get('/admin/mentors', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false, membershipStatus: 'approved' };
  // Paused mentors stay on this roster, because deciding who to invite back is the point of it.
  if (req.query.optedIn === 'true') filter.isMentor = true;
  else filter.$or = [{ isAlumni: true }, { isAdvisor: true }, { isSeniorAdvisor: true }];
  if (req.query.search) {
    filter.name = { $regex: req.query.search as string, $options: 'i' };
  }

  const [mentors, total] = await Promise.all([
    User.find(filter)
      .select('name avatar department batch profession isMentor mentorAreas isAlumni isAdvisor isSeniorAdvisor')
      .sort({ isMentor: -1, name: 1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const ids = mentors.map((m) => m._id);
  const counts = await Mentorship.aggregate([
    { $match: { mentor: { $in: ids } } },
    { $group: { _id: { mentor: '$mentor', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const loadMap = new Map<string, { active: number; pending: number; completed: number }>();
  for (const c of counts as any[]) {
    const key = c._id.mentor.toString();
    const row = loadMap.get(key) || { active: 0, pending: 0, completed: 0 };
    if (c._id.status in row) (row as any)[c._id.status] = c.count;
    loadMap.set(key, row);
  }

  const { maxActiveMentees } = await getMentorshipConfig();
  const enriched = mentors.map((m) => {
    const load = loadMap.get(m._id.toString()) || { active: 0, pending: 0, completed: 0 };
    return {
      ...m.toObject(),
      ...load,
      maxActiveMentees,
      atCapacity: !!maxActiveMentees && load.active >= maxActiveMentees,
    };
  });

  ApiResponse.paginated(res, enriched, total, page, limit);
}));

// Admin: turn a member's mentor listing on or off, for when someone asks to pause or is invited in
router.patch('/admin/mentors/:userId', authenticate(), authorize(UserRole.ADMIN), auditLog('mentorship.toggle_mentor', 'mentorships'), asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.userId as string, isDeleted: false });
  if (!user) throw ApiError.notFound('User not found');
  if (!user.isAlumni && !user.isAdvisor && !user.isSeniorAdvisor) {
    throw ApiError.badRequest('Only Alumni, Advisors, or Senior Advisors can be mentors');
  }

  user.isMentor = !!req.body.isMentor;
  if (Array.isArray(req.body.mentorAreas)) user.mentorAreas = req.body.mentorAreas;
  await user.save();

  await Notification.create({
    recipient: user._id,
    type: 'mentorship_request',
    title: user.isMentor ? 'Listed as a Mentor' : 'Mentor Listing Paused',
    message: user.isMentor
      ? 'You are now listed on the mentor directory and can receive mentorship requests.'
      : 'Your mentor listing has been paused, so you will not receive new requests.',
    link: '/dashboard/mentorship',
  });

  ApiResponse.success(res, user, user.isMentor ? 'Listed as mentor' : 'Mentor listing paused');
}));

// Admin: end a pairing on the parties' behalf, running the same cleanup the members' own actions do
router.patch('/admin/:id/status', authenticate(), authorize(UserRole.ADMIN), auditLog('mentorship.force_status', 'mentorships'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const status = req.body.status as 'completed' | 'cancelled';
  if (!['completed', 'cancelled'].includes(status)) {
    throw ApiError.badRequest('An admin can only complete or cancel a mentorship');
  }

  const mentorship = await Mentorship.findById(req.params.id as string);
  if (!mentorship) throw ApiError.notFound('Mentorship not found');
  if (mentorship.status === status) throw ApiError.badRequest(`This mentorship is already ${status}`);

  const wasActive = mentorship.status === 'active';
  mentorship.status = status;
  if (status === 'completed') mentorship.completedAt = new Date();
  mentorship.closedBy = req.user._id as any;
  mentorship.closeReason = req.body.reason || undefined;
  await mentorship.save();

  if (wasActive) {
    await removeFromConsultationGroup(mentorship.mentor.toString(), mentorship.mentee.toString());
  }

  const note = req.body.reason ? ` Reason: ${req.body.reason}` : '';
  await Notification.insertMany([mentorship.mentor, mentorship.mentee].map((recipient) => ({
    recipient,
    type: 'mentorship_request',
    title: `Mentorship ${status}`,
    message: `An administrator marked this mentorship as ${status}.${note}`,
    link: '/dashboard/mentorship',
  })));

  ApiResponse.success(res, mentorship, `Mentorship ${status}`);
}));

// Admin: pair a mentor with a mentee directly, for requests that never found their way
router.post('/admin/match', authenticate(), authorize(UserRole.ADMIN), auditLog('mentorship.match', 'mentorships'), asyncHandler(async (req, res) => {
  const { mentorId, menteeId, area } = req.body;
  if (!mentorId || !menteeId) throw ApiError.badRequest('Both a mentor and a mentee are required');
  if (mentorId === menteeId) throw ApiError.badRequest('A member cannot mentor themselves');

  const [mentor, mentee] = await Promise.all([
    User.findOne({ _id: mentorId, isDeleted: false }),
    User.findOne({ _id: menteeId, isDeleted: false }),
  ]);
  if (!mentor) throw ApiError.notFound('Mentor not found');
  if (!mentee) throw ApiError.notFound('Mentee not found');
  if (!mentor.isAlumni && !mentor.isAdvisor && !mentor.isSeniorAdvisor) {
    throw ApiError.badRequest('Only Alumni, Advisors, or Senior Advisors can be mentors');
  }

  const existing = await Mentorship.findOne({
    mentor: mentorId,
    mentee: menteeId,
    status: { $in: ['pending', 'active'] },
  });
  if (existing) throw ApiError.badRequest('These two already have a pending or active mentorship');

  await assertMentorHasRoom(mentorId);

  // An admin match starts active, since the pairing has already been agreed off-platform.
  const mentorship = await Mentorship.create({
    mentor: mentorId,
    mentee: menteeId,
    area,
    status: 'active',
    acceptedAt: new Date(),
  });

  await addToConsultationGroup(mentorId, mentor.name, menteeId);

  await Notification.insertMany([mentor._id, mentee._id].map((recipient) => ({
    recipient,
    type: 'mentorship_request',
    title: 'Mentorship Started',
    message: `An administrator paired ${mentor.name} with ${mentee.name}${area ? ` for "${area}"` : ''}.`,
    link: '/dashboard/mentorship',
  })));

  ApiResponse.success(res, mentorship, 'Mentorship created', 201);
}));

// Admin: CSV of whatever the current filters select, matching the table above it
router.get('/admin/export', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const filter = await buildAdminFilter(req.query);
  const rows = await Mentorship.find(filter)
    .populate('mentor', 'name email department')
    .populate('mentee', 'name email department')
    .sort({ createdAt: -1 })
    .lean();

  const clean = (v: unknown) => String(v ?? '').replace(/[,\n\r]/g, ' ');
  const header = 'Mentor,Mentor Email,Mentee,Mentee Email,Area,Status,Requested,Accepted,Completed,Close Reason\n';
  const body = rows.map((m: any) => [
    clean(m.mentor?.name), clean(m.mentor?.email), clean(m.mentee?.name), clean(m.mentee?.email),
    clean(m.area), clean(m.status),
    m.requestedAt ? new Date(m.requestedAt).toISOString().slice(0, 10) : '',
    m.acceptedAt ? new Date(m.acceptedAt).toISOString().slice(0, 10) : '',
    m.completedAt ? new Date(m.completedAt).toISOString().slice(0, 10) : '',
    clean(m.closeReason),
  ].join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="mentorships.csv"');
  res.send(header + body);
}));

// Admin: delete mentorship (also clean up group)
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('mentorship.delete', 'mentorships'), asyncHandler(async (req, res) => {
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
    // Every eligible member is listed unless they paused it, so an absent flag still counts as listed.
    isMentor: { $ne: false },
    $or: [
      { isAlumni: true },
      { isAdvisor: true },
      { isSeniorAdvisor: true },
    ],
  };

  const { areas: configuredAreas, maxActiveMentees } = await getMentorshipConfig();

  // Areas are derived per profile rather than stored, so filtering happens here and always agrees with the chips.
  const eligible = await User.find(filter)
    .select('name avatar department batch profession earningSource skills mentorAreas homeDistrict isAlumni isAdvisor isSeniorAdvisor')
    .sort({ name: 1 })
    .lean();

  const classified = eligible.map((m: any) => ({
    ...m,
    ...effectiveMentorAreas(m, configuredAreas),
  }));

  const wanted = typeof req.query.area === 'string' ? req.query.area : '';
  const matching = wanted ? classified.filter((m) => m.areas.includes(wanted)) : classified;

  const total = matching.length;
  const paged = matching.slice(getSkip({ page, limit }), getSkip({ page, limit }) + limit);

  const mentorIds = paged.map((m: any) => m._id);
  const menteeCounts = await Mentorship.aggregate([
    { $match: { mentor: { $in: mentorIds }, status: 'active' } },
    { $group: { _id: '$mentor', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(menteeCounts.map((c: any) => [c._id.toString(), c.count]));

  const enriched = paged.map((m: any) => {
    const active = countMap.get(m._id.toString()) || 0;
    return {
      ...m,
      activeMentees: active,
      maxActiveMentees,
      atCapacity: !!maxActiveMentees && active >= maxActiveMentees,
    };
  });

  ApiResponse.paginated(res, enriched, total, page, limit);
}));

// Programme rules a member needs when picking an area, plus how much of the cap they are already using
router.get('/config', authenticate(), asyncHandler(async (req, res) => {
  const cfg = await getMentorshipConfig();
  if (!req.user) return ApiResponse.success(res, { ...cfg, myActiveMentees: 0, myDerivedAreas: [] });

  const [myActiveMentees, me] = await Promise.all([
    activeMenteeCount((req.user._id as any).toString()),
    User.findById(req.user._id).select('profession earningSource skills').lean(),
  ]);

  ApiResponse.success(res, {
    ...cfg,
    myActiveMentees,
    myDerivedAreas: me ? classifyMentorAreas(me as any, cfg.areas) : [],
  });
}));

export default router;
