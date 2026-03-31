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
router.get('/my-attendance', authenticate(), eventController.myAttendance);
router.get('/:id', eventController.getById);
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createEventSchema }), auditLog('event.create', 'events'), eventController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateEventSchema }), auditLog('event.update', 'events'), eventController.update);
router.delete('/:id', authenticate(), authorize(UserRole.MODERATOR), auditLog('event.delete', 'events'), eventController.remove);
router.post('/:id/register', authenticate(), authorize(UserRole.MEMBER), eventController.register);
router.post('/:id/checkin', authenticate(), authorize(UserRole.MODERATOR), eventController.checkin);
router.post('/:id/attendance', authenticate(), authorize(UserRole.MODERATOR), eventController.submitAttendance);
router.post('/:id/feedback', authenticate(), authorize(UserRole.MEMBER), validate({ body: feedbackSchema }), eventController.submitFeedback);
router.get('/:id/attendance', authenticate(), authorize(UserRole.MODERATOR), eventController.getAttendance);

// Remove attendance record
router.delete('/:id/attendance/:userId', authenticate(), authorize(UserRole.MODERATOR), eventController.removeAttendance);

// QR code generation
router.post('/:id/qr', authenticate(), authorize(UserRole.MODERATOR), eventController.generateQrCode);

// Event reports/documents
router.post('/:id/reports', authenticate(), authorize(UserRole.MODERATOR), eventController.addReport);
router.delete('/:id/reports/:reportIndex', authenticate(), authorize(UserRole.MODERATOR), eventController.removeReport);

// Event photos
router.post('/:id/photos', authenticate(), authorize(UserRole.MODERATOR), eventController.addPhoto);
router.delete('/:id/photos/:photoIndex', authenticate(), authorize(UserRole.MODERATOR), eventController.removePhoto);
router.post('/:id/photos/:photoIndex/tag', authenticate(), authorize(UserRole.MODERATOR), eventController.tagPhoto);
router.delete('/:id/photos/:photoIndex/tag', authenticate(), authorize(UserRole.MODERATOR), eventController.untagPhoto);

export default router;
