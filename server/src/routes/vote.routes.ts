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
router.post('/', authenticate(), authorize(UserRole.ADMIN), validate({ body: createVoteSchema }), auditLog('vote.create', 'votes'), voteController.create);
router.patch('/:id', authenticate(), authorize(UserRole.ADMIN), validate({ body: updateVoteSchema }), auditLog('vote.update', 'votes'), voteController.update);
router.post('/:id/cast', authenticate(), authorize(UserRole.MEMBER), validate({ body: castVoteSchema }), voteController.castVote);
router.post('/:id/skip', authenticate(), authorize(UserRole.MEMBER), voteController.skipVote);
router.get('/:id/results', authenticate(), voteController.getResults);
router.get('/:id/stats', authenticate(), authorize(UserRole.ADMIN), voteController.getStats);
router.patch('/:id/close', authenticate(), authorize(UserRole.ADMIN), auditLog('vote.close', 'votes'), voteController.closeManually);
router.patch('/:id/publish', authenticate(), authorize(UserRole.ADMIN), auditLog('vote.publish', 'votes'), voteController.publishResults);

// Admin: delete vote
router.delete('/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('vote.delete', 'votes'), async (req, res, next) => {
  try {
    const { Vote } = await import('../models');
    const vote = await Vote.findById(req.params.id as string);
    if (!vote) return res.status(404).json({ success: false, message: 'Vote not found' });
    vote.isDeleted = true;
    await vote.save();
    res.json({ success: true, message: 'Vote deleted' });
  } catch (err) { next(err); }
});

export default router;
