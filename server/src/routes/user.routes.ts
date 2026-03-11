import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import {
  updateProfileSchema,
  changeRoleSchema,
  memberActionSchema,
  listUsersQuerySchema,
} from '../validators/user.validator';

const router = Router();

// Authenticated routes
router.get('/me', authenticate(), userController.getMe);
router.patch('/me', authenticate(), validate({ body: updateProfileSchema }), userController.updateMe);

// Member-accessible
router.get('/members', authenticate(), validate({ query: listUsersQuerySchema }), userController.listMembers);
router.get('/blood-donors', authenticate(), userController.listBloodDonors);

// Skill endorsement
router.post('/:id/endorse', authenticate(), authorize(UserRole.MEMBER), userController.endorseSkill);
router.delete('/:id/endorse', authenticate(), authorize(UserRole.MEMBER), userController.removeEndorsement);

// Member directory export (Admin+)
router.get('/export/directory', authenticate(), authorize(UserRole.ADMIN), userController.exportDirectory);

// Admin routes
router.get('/', authenticate(), authorize(UserRole.ADMIN), validate({ query: listUsersQuerySchema }), userController.listUsers);
router.get('/:id', authenticate(), userController.getUserById);

// Admin+ can edit any user's profile
router.patch('/:id/profile', authenticate(), authorize(UserRole.ADMIN), auditLog('user.admin_edit', 'users'), userController.adminUpdateUser);

// Role management
router.patch('/:id/role', authenticate(), authorize(UserRole.ADMIN), validate({ body: changeRoleSchema }), auditLog('user.role_change', 'users'), userController.changeRole);
router.patch('/:id/approve', authenticate(), authorize(UserRole.MODERATOR), auditLog('user.approve', 'users'), userController.approveMembership);
router.patch('/:id/reject', authenticate(), authorize(UserRole.MODERATOR), validate({ body: memberActionSchema }), auditLog('user.reject', 'users'), userController.rejectMembership);
router.patch('/:id/suspend', authenticate(), authorize(UserRole.ADMIN), validate({ body: memberActionSchema }), auditLog('user.suspend', 'users'), userController.suspendUser);

export default router;
