import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { UserRole } from '@rdswa/shared';
import { TRASH_RESOURCES, findTrashResource, TrashResource } from '../config/trashResources';
import { RETENTION_DAYS } from '../config/retention';

const router = Router();

// The bin holds records anyone could have deleted, so only a SuperAdmin may look through or act on it.
router.use(authenticate(), authorize(UserRole.SUPER_ADMIN));

const deletedFilter = (resource: TrashResource) => ({
  isDeleted: true,
  ...(resource.protect ?? {}),
});

const recoverable = () => TRASH_RESOURCES.filter((r) => r.recoverable);

/** Resolve the `:resource` segment, rejecting anything not in the registry. */
function resourceFromParam(key: string): TrashResource {
  const resource = findTrashResource(key);
  if (!resource || !resource.recoverable) throw ApiError.notFound('Unknown trash resource');
  return resource;
}

// What is in the bin, per resource
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const counts = await Promise.all(
      recoverable().map(async (resource) => ({
        key: resource.key,
        label: resource.label,
        count: await resource.model.countDocuments(deletedFilter(resource)),
      }))
    );

    ApiResponse.success(res, { retentionDays: RETENTION_DAYS, resources: counts });
  })
);

// One resource's deleted records, newest deletion first
router.get(
  '/:resource',
  asyncHandler(async (req, res) => {
    const resource = resourceFromParam(req.params.resource as string);
    const { page, limit } = parsePagination(req.query as any);
    const filter = deletedFilter(resource);

    const [docs, total] = await Promise.all([
      resource.model
        .find(filter)
        .select(resource.select)
        .sort({ deletedAt: -1, updatedAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit)
        .lean(),
      resource.model.countDocuments(filter),
    ]);

    const items = docs.map((doc: any) => ({
      _id: doc._id,
      title: resource.title(doc),
      // `deletedAt` is missing on records deleted before it was recorded, and retention reads updatedAt for those too.
      deletedAt: doc.deletedAt ?? doc.updatedAt ?? null,
      createdAt: doc.createdAt ?? null,
    }));

    ApiResponse.paginated(res, items, total, page, limit);
  })
);

router.patch(
  '/:resource/:id/restore',
  auditLog('trash.restore', 'system'),
  asyncHandler(async (req, res) => {
    const resource = resourceFromParam(req.params.resource as string);
    const restored = await resource.model.findOneAndUpdate(
      { _id: req.params.id as string, ...deletedFilter(resource) },
      { $set: { isDeleted: false } },
      { new: true }
    );
    if (!restored) throw ApiError.notFound(`Deleted ${resource.label.toLowerCase()} not found`);

    ApiResponse.success(res, null, 'Restored');
  })
);

router.delete(
  '/:resource/:id',
  auditLog('trash.permanent_delete', 'system'),
  asyncHandler(async (req, res) => {
    const resource = resourceFromParam(req.params.resource as string);
    const result = await resource.model.deleteOne({
      _id: req.params.id as string,
      ...deletedFilter(resource),
    });
    if (result.deletedCount === 0) {
      throw ApiError.notFound(`Deleted ${resource.label.toLowerCase()} not found`);
    }

    ApiResponse.success(res, null, 'Permanently deleted');
  })
);

export default router;
