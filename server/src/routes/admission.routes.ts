import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AdmissionCircular, AdmissionSeat, AdmissionCutoff } from '../models';
import { UserRole } from '@rdswa/shared';

const router = Router();

// ═══════════════════════════════════════════════════════
// Admission Circulars
// ═══════════════════════════════════════════════════════

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(300),
  url: z.string().url(),
  type: z.string().trim().max(60).optional(),
});

const externalLinkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().url(),
});

const circularBaseSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(300),
  content: z.string().max(50000).optional(),
  session: z.string().trim().min(2).max(20),
  applicationStartDate: z.string().datetime().optional().nullable(),
  applicationDeadline: z.string().datetime().optional().nullable(),
  examDate: z.string().datetime().optional().nullable(),
  resultDate: z.string().datetime().optional().nullable(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  externalLinks: z.array(externalLinkSchema).max(20).optional(),
  isPublished: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

const circularUpdateSchema = circularBaseSchema.partial();

/** GET /admissions/circulars — public list, sorted pinned + newest first. */
router.get(
  '/circulars',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { isDeleted: false, isPublished: true };
    if (req.query.session) filter.session = req.query.session;

    const docs = await AdmissionCircular.find(filter)
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 })
      .populate('createdBy', 'name avatar')
      .lean();
    ApiResponse.success(res, docs);
  })
);

/** GET /admissions/circulars/admin — all circulars including drafts, Moderator+. */
router.get(
  '/circulars/admin',
  authenticate(),
  authorize(UserRole.MODERATOR),
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { isDeleted: false };
    if (req.query.session) filter.session = req.query.session;
    const docs = await AdmissionCircular.find(filter)
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 })
      .populate('createdBy', 'name avatar')
      .lean();
    ApiResponse.success(res, docs);
  })
);

router.post(
  '/circulars',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: circularBaseSchema }),
  auditLog('admission.circular_create', 'admission_circulars'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.body as z.infer<typeof circularBaseSchema>;
    const doc = await AdmissionCircular.create({
      ...body,
      attachments: body.attachments || [],
      externalLinks: body.externalLinks || [],
      publishedAt: body.isPublished === false ? undefined : new Date(),
      createdBy: req.user._id,
    });
    ApiResponse.created(res, doc, 'Circular created');
  })
);

router.patch(
  '/circulars/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: circularUpdateSchema }),
  auditLog('admission.circular_update', 'admission_circulars'),
  asyncHandler(async (req, res) => {
    const update: Record<string, unknown> = { ...req.body };
    // First-time publish stamps publishedAt; subsequent edits leave it alone.
    if (update.isPublished === true) {
      const existing = await AdmissionCircular.findById(req.params.id).select('publishedAt');
      if (existing && !existing.publishedAt) update.publishedAt = new Date();
    }
    const doc = await AdmissionCircular.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: update },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Circular not found');
    ApiResponse.success(res, doc, 'Circular updated');
  })
);

router.delete(
  '/circulars/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  auditLog('admission.circular_delete', 'admission_circulars'),
  asyncHandler(async (req, res) => {
    const doc = await AdmissionCircular.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Circular not found');
    ApiResponse.success(res, null, 'Circular deleted');
  })
);

// ═══════════════════════════════════════════════════════
// Available Seats
// ═══════════════════════════════════════════════════════

const seatBaseSchema = z.object({
  category: z.string().trim().min(1).max(120),
  universityName: z.string().trim().min(1).max(200),
  aUnit: z.number().int().min(0).max(100000).optional(),
  bUnit: z.number().int().min(0).max(100000).optional(),
  cUnit: z.number().int().min(0).max(100000).optional(),
  session: z.string().trim().min(2).max(20),
  sortOrder: z.number().int().optional(),
});

const seatUpdateSchema = seatBaseSchema.partial();

router.get(
  '/seats',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { isDeleted: false };
    if (req.query.session) filter.session = req.query.session;
    const docs = await AdmissionSeat.find(filter)
      .sort({ sortOrder: 1, category: 1, universityName: 1 })
      .lean({ virtuals: true });
    ApiResponse.success(res, docs);
  })
);

/** Distinct session list — populates dropdowns on both public + admin pages. */
router.get(
  '/seats/sessions',
  asyncHandler(async (_req, res) => {
    const sessions = await AdmissionSeat.distinct('session', { isDeleted: false });
    ApiResponse.success(res, sessions.sort().reverse());
  })
);

router.post(
  '/seats',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatBaseSchema }),
  auditLog('admission.seat_create', 'admission_seats'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const doc = await AdmissionSeat.create({ ...req.body, createdBy: req.user._id });
    ApiResponse.created(res, doc, 'Seat row created');
  })
);

router.patch(
  '/seats/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatUpdateSchema }),
  auditLog('admission.seat_update', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const doc = await AdmissionSeat.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Seat row not found');
    ApiResponse.success(res, doc, 'Seat row updated');
  })
);

router.delete(
  '/seats/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  auditLog('admission.seat_delete', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const doc = await AdmissionSeat.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Seat row not found');
    ApiResponse.success(res, null, 'Seat row deleted');
  })
);

// ── Session-level bulk ops (Moderator+) ──────────────────
//
// Sessions / categories aren't first-class entities — they're plain strings
// stored on each row. These endpoints expose bulk operations across all rows
// of a given session (or session+category) without making admins click into
// every row individually.

/** Clone every non-deleted row from sourceSession into a new targetSession.
 *  Rejects when targetSession already contains rows so we never silently merge
 *  two sessions together (the user's explicit "same session multiple hobe na"
 *  rule). The source session keeps its data — only metadata fields are reset
 *  on the new copies (timestamps, createdBy). */
const seatCloneSchema = z.object({
  sourceSession: z.string().trim().min(2).max(20),
  targetSession: z.string().trim().min(2).max(20),
});

router.post(
  '/seats/sessions/clone',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatCloneSchema }),
  auditLog('admission.seat_session_clone', 'admission_seats'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { sourceSession, targetSession } = req.body as z.infer<typeof seatCloneSchema>;
    if (sourceSession === targetSession) {
      throw ApiError.badRequest('Target session must differ from source session.');
    }
    const existing = await AdmissionSeat.countDocuments({ session: targetSession, isDeleted: false });
    if (existing > 0) {
      throw ApiError.conflict(`Session "${targetSession}" already has data — pick a different label.`);
    }
    const source = await AdmissionSeat.find({ session: sourceSession, isDeleted: false }).lean();
    if (source.length === 0) {
      throw ApiError.notFound(`No rows found in source session "${sourceSession}".`);
    }
    const userId = req.user._id;
    const clones = source.map((row) => ({
      category: row.category,
      universityName: row.universityName,
      aUnit: row.aUnit,
      bUnit: row.bUnit,
      cUnit: row.cUnit,
      sortOrder: row.sortOrder,
      session: targetSession,
      createdBy: userId,
    }));
    const inserted = await AdmissionSeat.insertMany(clones);
    ApiResponse.created(res, { count: inserted.length, session: targetSession }, 'Session cloned');
  })
);

/** Rename a session label across every row that uses it. */
const seatSessionRenameSchema = z.object({
  from: z.string().trim().min(2).max(20),
  to: z.string().trim().min(2).max(20),
});

router.patch(
  '/seats/sessions/rename',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatSessionRenameSchema }),
  auditLog('admission.seat_session_rename', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const { from, to } = req.body as z.infer<typeof seatSessionRenameSchema>;
    if (from === to) throw ApiError.badRequest('New session label must differ from the old one.');
    const collision = await AdmissionSeat.countDocuments({ session: to, isDeleted: false });
    if (collision > 0) {
      throw ApiError.conflict(`Session "${to}" already exists — cannot merge by renaming.`);
    }
    const result = await AdmissionSeat.updateMany(
      { session: from, isDeleted: false },
      { $set: { session: to } }
    );
    if (result.matchedCount === 0) throw ApiError.notFound(`No rows found in session "${from}".`);
    ApiResponse.success(res, { matched: result.matchedCount, modified: result.modifiedCount }, 'Session renamed');
  })
);

/** Soft-delete every row in a session. */
const seatSessionDeleteSchema = z.object({
  session: z.string().trim().min(2).max(20),
});

router.delete(
  '/seats/sessions',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatSessionDeleteSchema }),
  auditLog('admission.seat_session_delete', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const { session } = req.body as z.infer<typeof seatSessionDeleteSchema>;
    const result = await AdmissionSeat.updateMany(
      { session, isDeleted: false },
      { $set: { isDeleted: true } }
    );
    if (result.matchedCount === 0) throw ApiError.notFound(`No rows found in session "${session}".`);
    ApiResponse.success(res, { deleted: result.modifiedCount }, `Session "${session}" deleted`);
  })
);

/** Rename a category within a session — affects only that session's rows. */
const seatCategoryRenameSchema = z.object({
  session: z.string().trim().min(2).max(20),
  from: z.string().trim().min(1).max(120),
  to: z.string().trim().min(1).max(120),
});

router.patch(
  '/seats/categories/rename',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatCategoryRenameSchema }),
  auditLog('admission.seat_category_rename', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const { session, from, to } = req.body as z.infer<typeof seatCategoryRenameSchema>;
    if (from === to) throw ApiError.badRequest('New category must differ from the old one.');
    const result = await AdmissionSeat.updateMany(
      { session, category: from, isDeleted: false },
      { $set: { category: to } }
    );
    if (result.matchedCount === 0) {
      throw ApiError.notFound(`No rows found in session "${session}" with category "${from}".`);
    }
    ApiResponse.success(res, { matched: result.matchedCount, modified: result.modifiedCount }, 'Category renamed');
  })
);

/** Soft-delete every row of a category in a given session. */
const seatCategoryDeleteSchema = z.object({
  session: z.string().trim().min(2).max(20),
  category: z.string().trim().min(1).max(120),
});

router.delete(
  '/seats/categories',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: seatCategoryDeleteSchema }),
  auditLog('admission.seat_category_delete', 'admission_seats'),
  asyncHandler(async (req, res) => {
    const { session, category } = req.body as z.infer<typeof seatCategoryDeleteSchema>;
    const result = await AdmissionSeat.updateMany(
      { session, category, isDeleted: false },
      { $set: { isDeleted: true } }
    );
    if (result.matchedCount === 0) {
      throw ApiError.notFound(`No rows found in session "${session}" with category "${category}".`);
    }
    ApiResponse.success(res, { deleted: result.modifiedCount }, `Category "${category}" deleted from session "${session}"`);
  })
);

// ═══════════════════════════════════════════════════════
// Cut-off Marks
// ═══════════════════════════════════════════════════════

const cutoffBaseSchema = z.object({
  faculty: z.string().trim().min(1).max(120),
  department: z.string().trim().min(1).max(120),
  unit: z.enum(['A', 'B', 'C']),
  firstPositionMerit: z.number().int().min(0).max(1_000_000).optional().nullable(),
  firstPositionScore: z.number().min(0).max(1000).optional().nullable(),
  lastPositionMerit: z.number().int().min(0).max(1_000_000).optional().nullable(),
  lastPositionScore: z.number().min(0).max(1000).optional().nullable(),
  dataSource: z.string().trim().max(120).optional(),
  session: z.string().trim().min(2).max(20),
  sortOrder: z.number().int().optional(),
});

const cutoffUpdateSchema = cutoffBaseSchema.partial();

router.get(
  '/cutoffs',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { isDeleted: false };
    if (req.query.session) filter.session = req.query.session;
    if (req.query.faculty) filter.faculty = req.query.faculty;
    const docs = await AdmissionCutoff.find(filter)
      .sort({ sortOrder: 1, faculty: 1, department: 1, unit: 1 })
      .lean();
    ApiResponse.success(res, docs);
  })
);

router.get(
  '/cutoffs/sessions',
  asyncHandler(async (_req, res) => {
    const sessions = await AdmissionCutoff.distinct('session', { isDeleted: false });
    ApiResponse.success(res, sessions.sort().reverse());
  })
);

router.post(
  '/cutoffs',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: cutoffBaseSchema }),
  auditLog('admission.cutoff_create', 'admission_cutoffs'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    try {
      const doc = await AdmissionCutoff.create({ ...req.body, createdBy: req.user._id });
      ApiResponse.created(res, doc, 'Cut-off row created');
    } catch (err: unknown) {
      // The unique index on (session, faculty, department, unit) prevents
      // accidental duplicates — surface a friendly 409 instead of a 500.
      if ((err as { code?: number }).code === 11000) {
        throw ApiError.conflict(
          'A cut-off row for this faculty, department, unit and session already exists.'
        );
      }
      throw err;
    }
  })
);

router.patch(
  '/cutoffs/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: cutoffUpdateSchema }),
  auditLog('admission.cutoff_update', 'admission_cutoffs'),
  asyncHandler(async (req, res) => {
    try {
      const doc = await AdmissionCutoff.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        { $set: req.body },
        { new: true }
      );
      if (!doc) throw ApiError.notFound('Cut-off row not found');
      ApiResponse.success(res, doc, 'Cut-off row updated');
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw ApiError.conflict(
          'Another cut-off row for this faculty, department, unit and session already exists.'
        );
      }
      throw err;
    }
  })
);

router.delete(
  '/cutoffs/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  auditLog('admission.cutoff_delete', 'admission_cutoffs'),
  asyncHandler(async (req, res) => {
    const doc = await AdmissionCutoff.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!doc) throw ApiError.notFound('Cut-off row not found');
    ApiResponse.success(res, null, 'Cut-off row deleted');
  })
);

export default router;
