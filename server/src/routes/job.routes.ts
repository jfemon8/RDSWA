import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { JobPost } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import { IJobPostDocument } from '../models/JobPost';

const router = Router();

// List active job posts (Public — anyone can view)
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: FilterQuery<IJobPostDocument> = { isDeleted: false, isActive: true };

  if (req.query.type) filter.type = req.query.type as string;
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search as string, $options: 'i' } },
      { company: { $regex: req.query.search as string, $options: 'i' } },
      { location: { $regex: req.query.search as string, $options: 'i' } },
    ];
  }

  const [jobs, total] = await Promise.all([
    JobPost.find(filter)
      .populate('postedBy', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    JobPost.countDocuments(filter),
  ]);

  ApiResponse.paginated(res, jobs, total, page, limit);
}));

// My job posts (authenticated) — MUST be before /:id to avoid route conflict
router.get('/my/posts', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { page, limit } = parsePagination(req.query as any);

  const [jobs, total] = await Promise.all([
    JobPost.find({ postedBy: req.user._id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    JobPost.countDocuments({ postedBy: req.user._id, isDeleted: false }),
  ]);

  ApiResponse.paginated(res, jobs, total, page, limit);
}));

// Get single job post (Public — anyone can view)
router.get('/:id', asyncHandler(async (req, res) => {
  const job = await JobPost.findOne({ _id: req.params.id as string, isDeleted: false })
    .populate('postedBy', 'name avatar department');
  if (!job) throw ApiError.notFound('Job post not found');
  ApiResponse.success(res, job);
}));

// Create job post (Alumni+ only)
router.post('/', authenticate(), authorize(UserRole.ALUMNI), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { title, company, location, type, description, requirements, salary, vacancy, applicationLink, deadline, expiresAt } = req.body;

  if (!title || !company || !type || !description) {
    throw ApiError.badRequest('Title, company, type, and description are required');
  }

  // Validate vacancy if provided
  if (vacancy !== undefined && vacancy !== null && vacancy !== '') {
    const v = Number(vacancy);
    if (!Number.isInteger(v) || v < 1) {
      throw ApiError.badRequest('Vacancy must be a positive integer');
    }
  }

  // Validate deadline if provided
  let parsedDeadline: Date | undefined;
  if (deadline) {
    parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      throw ApiError.badRequest('Deadline must be a valid date');
    }
  }

  const job = await JobPost.create({
    title,
    company,
    location,
    type,
    description,
    requirements: requirements || [],
    salary,
    vacancy: vacancy ? Number(vacancy) : undefined,
    applicationLink,
    deadline: parsedDeadline,
    expiresAt,
    postedBy: req.user._id,
  });

  ApiResponse.success(res, job, 'Job posted', 201);
}));

// Update job post (owner or Admin)
router.patch('/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const job = await JobPost.findOne({ _id: req.params.id as string, isDeleted: false });
  if (!job) throw ApiError.notFound('Job post not found');

  const isOwner = job.postedBy.toString() === (req.user._id as any).toString();
  const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);
  if (!isOwner && !isAdmin) throw ApiError.forbidden('Not authorized');

  const allowed = ['title', 'company', 'location', 'type', 'description', 'requirements', 'salary', 'vacancy', 'applicationLink', 'deadline', 'expiresAt', 'isActive'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      let value = req.body[key];
      if (key === 'vacancy' && value !== null && value !== '') value = Number(value);
      if (key === 'vacancy' && (value === null || value === '')) value = undefined;
      if (key === 'deadline' && value) value = new Date(value);
      if (key === 'deadline' && !value) value = undefined;
      (job as any)[key] = value;
    }
  }
  await job.save();

  ApiResponse.success(res, job, 'Job updated');
}));

// Delete job post (owner or Admin)
router.delete('/:id', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const job = await JobPost.findOne({ _id: req.params.id as string, isDeleted: false });
  if (!job) throw ApiError.notFound('Job post not found');

  const isOwner = job.postedBy.toString() === (req.user._id as any).toString();
  const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);
  if (!isOwner && !isAdmin) throw ApiError.forbidden('Not authorized');

  job.isDeleted = true;
  await job.save();

  ApiResponse.success(res, null, 'Job deleted');
}));

export default router;
