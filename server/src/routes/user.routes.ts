import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
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

// Skill endorsement (any authenticated user)
router.post('/:id/endorse', authenticate(), userController.endorseSkill);
router.delete('/:id/endorse', authenticate(), userController.removeEndorsement);

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

// SuperAdmin: soft-delete user
router.delete('/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('user.delete', 'users'), asyncHandler(async (req, res) => {
  const { User } = await import('../models');
  const id = req.params.id as string;
  const target = await User.findById(id);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === UserRole.SUPER_ADMIN) throw ApiError.forbidden('Cannot delete a SuperAdmin');
  target.isDeleted = true;
  target.isActive = false;
  await target.save();
  ApiResponse.success(res, null, 'User deleted');
}));

export default router;
