import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { auditLog } from "../middlewares/audit.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { UserRole } from "@rdswa/shared";
import {
  updateProfileSchema,
  changeRoleSchema,
  memberActionSchema,
  listUsersQuerySchema,
  forceSetPasswordSchema,
} from "../validators/user.validator";
import mongoose from "mongoose";
import { Donation } from "../models";
import {
  canSeeDonationDetails,
  donationScopeFilter,
} from "../services/userDonations.service";
import { sendEmail } from "../config/mail";
import {
  renderEmailLayout,
  getAppUrl,
  escapeHtml,
} from "../utils/emailTemplate";

const router = Router();

// Authenticated routes
router.get("/me", authenticate(), userController.getMe);
router.patch(
  "/me",
  authenticate(),
  validate({ body: updateProfileSchema }),
  userController.updateMe,
);

// Self-delete account (requires password confirmation)
router.delete(
  "/me",
  authenticate(),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { password } = req.body;
    if (!password)
      throw ApiError.badRequest("Password is required to delete your account");

    const { User } = await import("../models");
    const user = await User.findById(req.user._id).select("+password");
    if (!user) throw ApiError.notFound("User not found");
    if (user.role === UserRole.SUPER_ADMIN)
      throw ApiError.forbidden("SuperAdmin accounts cannot be self-deleted");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw ApiError.badRequest("Incorrect password");

    user.isDeleted = true;
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();

    res.clearCookie("refreshToken");
    ApiResponse.success(res, null, "Account deleted successfully");
  }),
);

// Public member directory (optional auth for visibility filtering)
router.get(
  "/members",
  authenticate(true),
  validate({ query: listUsersQuerySchema }),
  userController.listMembers,
);
router.get("/blood-donors", authenticate(true), userController.listBloodDonors);

// Skill endorsement (any authenticated user)
router.post("/:id/endorse", authenticate(), userController.endorseSkill);
router.delete("/:id/endorse", authenticate(), userController.removeEndorsement);

// Member directory export (Admin+)
router.get(
  "/export/directory",
  authenticate(),
  authorize(UserRole.ADMIN),
  userController.exportDirectory,
);

// Admin routes
router.get(
  "/",
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ query: listUsersQuerySchema }),
  userController.listUsers,
);
router.get(
  "/deleted",
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  validate({ query: listUsersQuerySchema }),
  userController.listDeletedUsers,
);
router.get("/:id", authenticate(true), userController.getUserById);

// Anyone may see what a member has given in total, but only the member and Admin+ see the records behind it.
router.get(
  "/:id/donations",
  authenticate(true),
  asyncHandler(async (req, res) => {
    const donorId = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(donorId))
      throw ApiError.badRequest("Invalid user id");
    const viewerId = req.user ? (req.user._id as any).toString() : undefined;
    const canSeeDetails = canSeeDonationDetails(
      donorId,
      viewerId,
      req.user?.role,
    );
    const filter = donationScopeFilter(donorId, canSeeDetails);

    const [totals, byType, donations] = await Promise.all([
      Donation.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            lastAt: { $max: "$donationDate" },
          },
        },
      ]),
      Donation.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      canSeeDetails
        ? Donation.find(filter)
            .select(
              "amount type paymentMethod donationDate createdAt receiptNumber visibility campaign event note",
            )
            .populate("campaign", "title")
            .populate("event", "title")
            .sort({ donationDate: -1, createdAt: -1 })
            .limit(100)
            .lean()
        : Promise.resolve([]),
    ]);

    ApiResponse.success(res, {
      canSeeDetails,
      total: totals[0]?.total || 0,
      count: totals[0]?.count || 0,
      lastDonationAt: totals[0]?.lastAt || null,
      byType: canSeeDetails ? byType : [],
      donations,
    });
  }),
);

// Admin+ can edit any user's profile
router.patch(
  "/:id/profile",
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog("user.admin_edit", "users"),
  userController.adminUpdateUser,
);

// Role management
router.patch(
  "/:id/role",
  authenticate(),
  authorize(UserRole.ADMIN),
  validate({ body: changeRoleSchema }),
  auditLog("user.role_change", "users"),
  userController.changeRole,
);

// Alumni / Advisor / Senior Advisor tag management (Admin+)
router.patch(
  "/:id/alumni",
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog("user.alumni_set", "users"),
  userController.setAlumni,
);
router.patch(
  "/:id/advisor",
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog("user.advisor_set", "users"),
  userController.setAdvisor,
);
router.patch(
  "/:id/senior-advisor",
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog("user.senior_advisor_set", "users"),
  userController.setSeniorAdvisor,
);

router.patch(
  "/:id/approve",
  authenticate(),
  authorize(UserRole.MODERATOR),
  auditLog("user.approve", "users"),
  userController.approveMembership,
);
router.patch(
  "/:id/reject",
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: memberActionSchema }),
  auditLog("user.reject", "users"),
  userController.rejectMembership,
);
router.patch(
  "/:id/suspend",
  authenticate(),
  authorize(UserRole.ADMIN),
  validate({ body: memberActionSchema }),
  auditLog("user.suspend", "users"),
  userController.suspendUser,
);
router.patch(
  "/:id/unsuspend",
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog("user.unsuspend", "users"),
  userController.unsuspendUser,
);

// SuperAdmin force-set of a user's password, audited and emailed to the target, and blocked against other SuperAdmins so none can lock out another.
router.patch(
  "/:id/force-password",
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  validate({ body: forceSetPasswordSchema }),
  auditLog("user.force_password_set", "users"),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { User, Notification } = await import("../models");
    const id = req.params.id as string;
    const { newPassword } = req.body as { newPassword: string };

    if ((req.user._id as any).toString() === id) {
      throw ApiError.badRequest(
        "Use the standard change-password flow for your own account",
      );
    }

    const target = await User.findById(id).select("+password");
    if (!target) throw ApiError.notFound("User not found");
    if (target.isDeleted)
      throw ApiError.badRequest("Cannot set password for a deleted user");
    if (target.role === UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden(
        "Cannot force-set another SuperAdmin's password",
      );
    }

    // The User pre-save hook hashes when `password` is modified.
    target.password = newPassword;
    target.passwordResetToken = undefined;
    target.passwordResetExpiry = undefined;
    await target.save();

    // Notify the target so they know their password was changed by an admin.
    await Notification.create({
      recipient: target._id,
      type: "password_reset_by_admin",
      title: "Your password was reset",
      message: `Your account password was reset by ${req.user.name || "an administrator"}. If you did not expect this, contact RDSWA support immediately.`,
      link: "/dashboard/profile",
    });

    // Email the user too — async, doesn't block the response.
    const adminName = req.user.name || "an administrator";
    const html = await renderEmailLayout({
      heading: "Your password was reset",
      preheader: "An admin reset your RDSWA password.",
      greeting: `Hello ${target.name},`,
      intro: [
        `Your RDSWA account password was reset by ${escapeHtml(adminName)}.`,
        "You can now sign in with the new password that was provided to you.",
      ],
      cta: { label: "Open RDSWA", url: `${getAppUrl()}/login` },
      footerNote:
        "If you did not expect this change, please contact RDSWA support immediately.",
    });
    void sendEmail(target.email, "Your RDSWA password was reset", html).catch(
      (err: any) => {
        console.error(
          `[forcePasswordSet] Email failed to ${target.email}:`,
          err?.code || "",
          err?.message || err,
        );
      },
    );

    ApiResponse.success(res, null, "Password updated");
  }),
);

// SuperAdmin: soft-delete user
router.delete(
  "/:id",
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  auditLog("user.delete", "users"),
  asyncHandler(async (req, res) => {
    const { User } = await import("../models");
    const id = req.params.id as string;
    const target = await User.findById(id);
    if (!target) throw ApiError.notFound("User not found");
    if (target.role === UserRole.SUPER_ADMIN)
      throw ApiError.forbidden("Cannot delete a SuperAdmin");
    target.isDeleted = true;
    target.isActive = false;
    target.deletedAt = new Date();
    await target.save();
    ApiResponse.success(res, null, "User deleted");
  }),
);

router.patch(
  "/:id/restore",
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  auditLog("user.restore", "users"),
  userController.restoreUser,
);

export default router;
