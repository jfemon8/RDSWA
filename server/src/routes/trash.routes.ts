import { Router } from 'express';
import { Types } from 'mongoose';
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
import { describeRecord } from '../utils/describeRecord';

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

/** A malformed id is a miss, not the cast error Mongoose would otherwise raise. */
function objectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Record not found');
  return new Types.ObjectId(id);
}

/** Reference fields, so the detail panel can name what a record points at. */
function referencePaths(resource: TrashResource): string[] {
  return Object.entries(resource.model.schema.paths)
    .filter(([, type]: [string, any]) => type.instance === 'ObjectId' && type.options?.ref)
    .map(([path]) => path);
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
        // `updatedAt` has to come along, since it stands in for a missing `deletedAt` below.
        .select(`${resource.select} updatedAt`)
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

// What one deleted record was, for a last look before restoring or erasing it
router.get(
  '/:resource/:id',
  asyncHandler(async (req, res) => {
    const resource = resourceFromParam(req.params.resource as string);
    const doc: any = await resource.model
      .findOne({ _id: objectId(req.params.id as string), ...deletedFilter(resource) })
      // References are pulled in by name, since a bare id tells the reader nothing.
      .populate(referencePaths(resource), 'name title')
      .lean();
    if (!doc) throw ApiError.notFound(`Deleted ${resource.label.toLowerCase()} not found`);

    ApiResponse.success(res, {
      _id: doc._id,
      title: resource.title(doc),
      createdAt: doc.createdAt ?? null,
      deletedAt: doc.deletedAt ?? doc.updatedAt ?? null,
      details: describeRecord(doc, resource.model.schema),
    });
  })
);

router.patch(
  '/:resource/:id/restore',
  auditLog('trash.restore', 'system'),
  asyncHandler(async (req, res) => {
    const resource = resourceFromParam(req.params.resource as string);
    const restored = await resource.model.findOneAndUpdate(
      { _id: objectId(req.params.id as string), ...deletedFilter(resource) },
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
      _id: objectId(req.params.id as string),
      ...deletedFilter(resource),
    });
    if (result.deletedCount === 0) {
      throw ApiError.notFound(`Deleted ${resource.label.toLowerCase()} not found`);
    }

    ApiResponse.success(res, null, 'Permanently deleted');
  })
);

export default router;
