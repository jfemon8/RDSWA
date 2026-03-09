import { Router } from 'express';
import * as eventController from '../controllers/event.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import { createEventSchema, updateEventSchema, feedbackSchema } from '../validators/event.validator';

const router = Router();

router.get('/', authenticate(true), eventController.list);
router.get('/:id', eventController.getById);
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createEventSchema }), auditLog('event.create', 'events'), eventController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateEventSchema }), auditLog('event.update', 'events'), eventController.update);
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('event.delete', 'events'), eventController.remove);
router.post('/:id/register', authenticate(), authorize(UserRole.MEMBER), eventController.register);
router.post('/:id/checkin', authenticate(), authorize(UserRole.MODERATOR), eventController.checkin);
router.post('/:id/attendance', authenticate(), authorize(UserRole.MODERATOR), eventController.submitAttendance);
router.post('/:id/feedback', authenticate(), authorize(UserRole.MEMBER), validate({ body: feedbackSchema }), eventController.submitFeedback);
router.get('/:id/attendance', authenticate(), authorize(UserRole.MODERATOR), eventController.getAttendance);

export default router;
