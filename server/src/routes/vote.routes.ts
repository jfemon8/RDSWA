import { Router } from 'express';
import * as voteController from '../controllers/vote.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import { createVoteSchema, updateVoteSchema, castVoteSchema } from '../validators/vote.validator';

const router = Router();

router.get('/', authenticate(), voteController.list);
router.get('/:id', authenticate(), voteController.getById);
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createVoteSchema }), auditLog('vote.create', 'votes'), voteController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateVoteSchema }), auditLog('vote.update', 'votes'), voteController.update);
router.post('/:id/cast', authenticate(), authorize(UserRole.MEMBER), validate({ body: castVoteSchema }), voteController.castVote);
router.get('/:id/results', authenticate(), voteController.getResults);
router.get('/:id/stats', authenticate(), authorize(UserRole.MODERATOR), voteController.getStats);
router.patch('/:id/close', authenticate(), authorize(UserRole.MODERATOR), auditLog('vote.close', 'votes'), voteController.closeManually);
router.patch('/:id/publish', authenticate(), authorize(UserRole.MODERATOR), auditLog('vote.publish', 'votes'), voteController.publishResults);

export default router;
