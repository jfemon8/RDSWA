import { Router } from 'express';
import * as committeeController from '../controllers/committee.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import {
  createCommitteeSchema,
  updateCommitteeSchema,
  addCommitteeMemberSchema,
} from '../validators/committee.validator';
import { cacheResponse } from '../middlewares/cache.middleware';

const router = Router();

// Public (cached)
router.get('/', cacheResponse(300), committeeController.getAll);
router.get('/current', cacheResponse(300), committeeController.getCurrent);
router.get('/:id', committeeController.getById);

// Moderator+
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createCommitteeSchema }), auditLog('committee.create', 'committees'), committeeController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateCommitteeSchema }), auditLog('committee.update', 'committees'), committeeController.update);
router.post('/:id/archive', authenticate(), authorize(UserRole.MODERATOR), auditLog('committee.archive', 'committees'), committeeController.archive);
router.post('/:id/members', authenticate(), authorize(UserRole.MODERATOR), validate({ body: addCommitteeMemberSchema }), auditLog('committee.add_member', 'committees'), committeeController.addMember);
router.delete('/:id/members/:userId', authenticate(), authorize(UserRole.MODERATOR), auditLog('committee.remove_member', 'committees'), committeeController.removeMember);

// Admin+: delete committee (soft-delete)
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('committee.delete', 'committees'), committeeController.remove);

export default router;
