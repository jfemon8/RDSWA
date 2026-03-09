import { Router } from 'express';
import * as noticeController from '../controllers/notice.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import { createNoticeSchema, updateNoticeSchema } from '../validators/notice.validator';

const router = Router();

router.get('/', authenticate(true), noticeController.list);
router.get('/:id', noticeController.getById);
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createNoticeSchema }), auditLog('notice.create', 'notices'), noticeController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateNoticeSchema }), auditLog('notice.update', 'notices'), noticeController.update);
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('notice.delete', 'notices'), noticeController.remove);
router.patch('/:id/archive', authenticate(), authorize(UserRole.ADMIN), auditLog('notice.archive', 'notices'), noticeController.archive);

export default router;
