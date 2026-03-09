import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { DocumentModel } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';

const router = Router();

// List documents
router.get('/', authenticate(true), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false };

  // Non-authenticated users only see public docs
  if (!req.user) {
    filter.isPublic = true;
  } else if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN) {
    filter.$or = [
      { isPublic: true },
      { accessRoles: req.user.role },
    ];
  }

  if (req.query.category) filter.category = req.query.category;

  const [docs, total] = await Promise.all([
    DocumentModel.find(filter).populate('uploadedBy', 'name').sort({ createdAt: -1 })
      .skip(getSkip({ page, limit })).limit(limit),
    DocumentModel.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, docs, total, page, limit);
}));

// Get by ID
router.get('/:id', authenticate(true), asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findOne({ _id: req.params.id, isDeleted: false })
    .populate('uploadedBy', 'name');
  if (!doc) throw ApiError.notFound('Document not found');
  ApiResponse.success(res, doc);
}));

// Download (increment count)
router.get('/:id/download', asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $inc: { downloadCount: 1 } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Document not found');
  ApiResponse.success(res, { fileUrl: doc.fileUrl, title: doc.title });
}));

// Upload document
router.post('/', authenticate(), authorize(UserRole.MODERATOR), auditLog('document.create', 'documents'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const doc = await DocumentModel.create({ ...req.body, uploadedBy: req.user._id });
  ApiResponse.created(res, doc, 'Document uploaded');
}));

// Update
router.patch('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('document.update', 'documents'), asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Document not found');
  ApiResponse.success(res, doc, 'Document updated');
}));

// Delete
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('document.delete', 'documents'), asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Document not found');
  ApiResponse.success(res, null, 'Document deleted');
}));

export default router;
