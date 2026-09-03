import { Router } from 'express';
import * as eventController from '../controllers/event.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import {
  createEventSchema,
  updateEventSchema,
  feedbackSchema,
  checkinSchema,
  manualAttendanceSchema,
  bulkAttendanceSchema,
  selfCheckinSchema,
  registerSchema,
  addRegistrationSchema,
  updateRegistrationSchema,
} from '../validators/event.validator';

const router = Router();

router.get('/', authenticate(true), eventController.list);
router.get('/my-attendance', authenticate(), eventController.myAttendance);
// Optional auth so a signed-in visitor also gets their own registration back.
router.get('/:id', authenticate(true), eventController.getById);
router.post('/', authenticate(), authorize(UserRole.MODERATOR), validate({ body: createEventSchema }), auditLog('event.create', 'events'), eventController.create);
router.patch('/:id', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateEventSchema }), auditLog('event.update', 'events'), eventController.update);
router.delete('/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('event.delete', 'events'), eventController.remove);
router.post('/:id/register', authenticate(), authorize(UserRole.MEMBER), validate({ body: registerSchema }), eventController.register);
router.delete('/:id/register', authenticate(), authorize(UserRole.MEMBER), eventController.withdrawRegistration);

// Registrations (Moderator+)
router.get('/:id/registrations', authenticate(), authorize(UserRole.MODERATOR), eventController.getRegistrations);
router.get('/:id/registrations/export', authenticate(), authorize(UserRole.MODERATOR), eventController.exportRegistrations);
router.post('/:id/registrations', authenticate(), authorize(UserRole.MODERATOR), validate({ body: addRegistrationSchema }), auditLog('event.registration_add', 'events'), eventController.setRegistration);
router.patch('/:id/registrations/:userId', authenticate(), authorize(UserRole.MODERATOR), validate({ body: updateRegistrationSchema }), auditLog('event.registration_update', 'events'), eventController.updateRegistration);
router.delete('/:id/registrations/:userId', authenticate(), authorize(UserRole.MODERATOR), auditLog('event.registration_remove', 'events'), eventController.removeRegistration);
router.get('/:id/attendance/export', authenticate(), authorize(UserRole.MODERATOR), eventController.exportAttendance);
router.post('/:id/checkin', authenticate(), authorize(UserRole.MODERATOR), validate({ body: checkinSchema }), eventController.checkin);
router.post('/:id/attendance', authenticate(), authorize(UserRole.MODERATOR), validate({ body: manualAttendanceSchema }), eventController.submitAttendance);
router.post('/:id/attendance/bulk', authenticate(), authorize(UserRole.MODERATOR), validate({ body: bulkAttendanceSchema }), eventController.bulkAttendance);
router.post('/:id/attendance/self', authenticate(), validate({ body: selfCheckinSchema }), eventController.selfCheckin);
router.patch('/:id/attendance/:userId/approve', authenticate(), authorize(UserRole.MODERATOR), eventController.approveAttendance);
router.patch('/:id/attendance/:userId/reject', authenticate(), authorize(UserRole.MODERATOR), eventController.rejectAttendance);
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
