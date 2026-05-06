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
  forceSetPasswordSchema,
} from '../validators/user.validator';
import { sendEmail } from '../config/mail';

const router = Router();

// Authenticated routes
router.get('/me', authenticate(), userController.getMe);
router.patch('/me', authenticate(), validate({ body: updateProfileSchema }), userController.updateMe);

// Self-delete account (requires password confirmation)
router.delete('/me', authenticate(), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { password } = req.body;
  if (!password) throw ApiError.badRequest('Password is required to delete your account');

  const { User } = await import('../models');
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === UserRole.SUPER_ADMIN) throw ApiError.forbidden('SuperAdmin accounts cannot be self-deleted');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw ApiError.badRequest('Incorrect password');

  user.isDeleted = true;
  user.isActive = false;
  await user.save();

  res.clearCookie('refreshToken');
  ApiResponse.success(res, null, 'Account deleted successfully');
}));

// Public member directory (optional auth for visibility filtering)
router.get('/members', authenticate(true), validate({ query: listUsersQuerySchema }), userController.listMembers);
router.get('/blood-donors', authenticate(true), userController.listBloodDonors);

// Skill endorsement (any authenticated user)
router.post('/:id/endorse', authenticate(), userController.endorseSkill);
router.delete('/:id/endorse', authenticate(), userController.removeEndorsement);

// Member directory export (Admin+)
router.get('/export/directory', authenticate(), authorize(UserRole.ADMIN), userController.exportDirectory);

// Admin routes
router.get('/', authenticate(), authorize(UserRole.MODERATOR), validate({ query: listUsersQuerySchema }), userController.listUsers);
router.get('/:id', authenticate(true), userController.getUserById);

// Admin+ can edit any user's profile
router.patch('/:id/profile', authenticate(), authorize(UserRole.ADMIN), auditLog('user.admin_edit', 'users'), userController.adminUpdateUser);

// Role management
router.patch('/:id/role', authenticate(), authorize(UserRole.ADMIN), validate({ body: changeRoleSchema }), auditLog('user.role_change', 'users'), userController.changeRole);

// Alumni / Advisor / Senior Advisor tag management (Admin+)
router.patch('/:id/alumni', authenticate(), authorize(UserRole.ADMIN), auditLog('user.alumni_set', 'users'), userController.setAlumni);
router.patch('/:id/advisor', authenticate(), authorize(UserRole.ADMIN), auditLog('user.advisor_set', 'users'), userController.setAdvisor);
router.patch('/:id/senior-advisor', authenticate(), authorize(UserRole.ADMIN), auditLog('user.senior_advisor_set', 'users'), userController.setSeniorAdvisor);

router.patch('/:id/approve', authenticate(), authorize(UserRole.MODERATOR), auditLog('user.approve', 'users'), userController.approveMembership);
router.patch('/:id/reject', authenticate(), authorize(UserRole.MODERATOR), validate({ body: memberActionSchema }), auditLog('user.reject', 'users'), userController.rejectMembership);
router.patch('/:id/suspend', authenticate(), authorize(UserRole.ADMIN), validate({ body: memberActionSchema }), auditLog('user.suspend', 'users'), userController.suspendUser);
router.patch('/:id/unsuspend', authenticate(), authorize(UserRole.ADMIN), auditLog('user.unsuspend', 'users'), userController.unsuspendUser);

// SuperAdmin: force-set any user's password (overrides existing password).
// Sensitive action — audited, notifies the target user, and emails them so
// they're never left wondering why their old password stopped working.
// Guard: a SuperAdmin cannot force-set another SuperAdmin's password (would
// allow one SuperAdmin to lock another out). A SuperAdmin can still
// force-set their own via the normal "change password" flow if needed.
router.patch(
  '/:id/force-password',
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  validate({ body: forceSetPasswordSchema }),
  auditLog('user.force_password_set', 'users'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { User, Notification } = await import('../models');
    const id = req.params.id as string;
    const { newPassword } = req.body as { newPassword: string };

    if ((req.user._id as any).toString() === id) {
      throw ApiError.badRequest('Use the standard change-password flow for your own account');
    }

    const target = await User.findById(id).select('+password');
    if (!target) throw ApiError.notFound('User not found');
    if (target.isDeleted) throw ApiError.badRequest('Cannot set password for a deleted user');
    if (target.role === UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Cannot force-set another SuperAdmin\'s password');
    }

    // The User pre-save hook hashes when `password` is modified.
    target.password = newPassword;
    target.passwordResetToken = undefined;
    target.passwordResetExpiry = undefined;
    await target.save();

    // Notify the target so they know their password was changed by an admin.
    await Notification.create({
      recipient: target._id,
      type: 'password_reset_by_admin',
      title: 'Your password was reset',
      message: `Your account password was reset by ${req.user.name || 'an administrator'}. If you did not expect this, contact RDSWA support immediately.`,
      link: '/dashboard/profile',
    });

    // Email the user too — async, doesn't block the response.
    void sendEmail(
      target.email,
      'Your RDSWA password was reset',
      `<h2>Your password was reset</h2>
       <p>Hello ${target.name},</p>
       <p>Your RDSWA account password was reset by an administrator.</p>
       <p>You can now sign in with the new password provided to you. If you did not expect this change, please contact RDSWA support immediately.</p>`
    ).catch((err: any) => {
      console.error(`[forcePasswordSet] Email failed to ${target.email}:`, err?.code || '', err?.message || err);
    });

    ApiResponse.success(res, null, 'Password updated');
  })
);

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
