import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Vacation } from '../models/Vacation';
import { UserRole } from '@rdswa/shared';
import { createVacationSchema, updateVacationSchema } from '../validators/vacation.validator';

const router = Router();

/**
 * Vacation calendar — yearly records (one per academic year, e.g. "2026-27")
 * holding a list of holidays/breaks plus optional supporting attachments.
 *
 * Public: anyone can list/read.
 * Admin: Moderator+ can create/update/delete.
 */

// List all academic years (newest first). Public — no auth required.
router.get('/', asyncHandler(async (_req, res) => {
  const list = await Vacation.find({ isDeleted: false })
    .sort({ academicYear: -1 })
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .lean();
  ApiResponse.success(res, list);
}));

// Get one academic year by id. Public.
router.get('/:id', asyncHandler(async (req, res) => {
  const vac = await Vacation.findOne({ _id: req.params.id as string, isDeleted: false })
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');
  if (!vac) throw ApiError.notFound('Vacation calendar not found');
  ApiResponse.success(res, vac);
}));

// Create a new academic-year record (Moderator+).
router.post(
  '/',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: createVacationSchema }),
  auditLog('vacation.create', 'vacations'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();

    // Pre-flight uniqueness check so the user gets a clear 400 instead of a
    // raw Mongo E11000. The partial unique index still backstops a race.
    const existing = await Vacation.findOne({
      academicYear: req.body.academicYear,
      isDeleted: false,
    });
    if (existing) {
      throw ApiError.badRequest(`Academic year ${req.body.academicYear} already exists`);
    }

    const created = await Vacation.create({
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    ApiResponse.created(res, created, 'Vacation calendar created');
  })
);

// Update (Moderator+) — full or partial.
router.patch(
  '/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: updateVacationSchema }),
  auditLog('vacation.update', 'vacations'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const id = req.params.id as string;

    // If renaming the academicYear, refuse the rename when another active
    // record already owns the new name.
    if (req.body.academicYear) {
      const conflict = await Vacation.findOne({
        academicYear: req.body.academicYear,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (conflict) {
        throw ApiError.badRequest(`Academic year ${req.body.academicYear} already exists`);
      }
    }

    const updated = await Vacation.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { ...req.body, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (!updated) throw ApiError.notFound('Vacation calendar not found');
    ApiResponse.success(res, updated, 'Vacation calendar updated');
  })
);

// Soft-delete (Moderator+).
router.delete(
  '/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  auditLog('vacation.delete', 'vacations'),
  asyncHandler(async (req, res) => {
    const updated = await Vacation.findOneAndUpdate(
      { _id: req.params.id as string, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!updated) throw ApiError.notFound('Vacation calendar not found');
    ApiResponse.success(res, null, 'Vacation calendar deleted');
  })
);

export default router;
