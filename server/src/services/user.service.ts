import {
  User,
  IUserDocument,
  RoleAssignment,
  Notification,
  ChatGroup,
} from "../models";
import { ApiError } from "../utils/ApiError";
import { parsePagination, getSkip } from "../utils/pagination";
import { UserRole, ROLE_HIERARCHY } from "@rdswa/shared";
import { resolveBaseRole } from "../utils/resolveBaseRole";
import { SUPER_ADMIN_EMAILS } from "../config/constants";
import { FilterQuery } from "mongoose";
import { notificationService } from "./notification.service";
import {
  ensureDepartmentGroup,
  ensureCentralGroup,
} from "../jobs/groupInitializer";
import { validateAcademicFields } from "../utils/validateAcademicFields";

import { escapeRegex } from "../utils/escapeRegex";
/** Fields that can be marked private by users */
const PRIVATE_FIELDS = [
  "phone",
  "email",
  "dateOfBirth",
  "nid",
  "presentAddress",
  "permanentAddress",
  "bloodGroup",
  "studentId",
  "registrationNumber",
  "facebook",
  "linkedin",
] as const;

/** Auth and identity fields no profile edit may touch, since `email` alone can trigger SuperAdmin auto-promotion. */
const PROTECTED_ADMIN_EDIT_FIELDS = [
  "password",
  "refreshTokens",
  "role",
  "email",
  "emailVerificationToken",
  "passwordResetToken",
  "otp",
] as const;

/** Check if a role is at least Moderator level */
function isModeratorOrAbove(role: string): boolean {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  const modIdx = ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
  return idx >= modIdx;
}

/** Strip private fields per the user's profileVisibility settings, which Moderator+ bypasses entirely. */
function applyVisibilityFilter(user: any, viewerRole?: string): any {
  if (!user) return user;
  if (viewerRole && isModeratorOrAbove(viewerRole)) return user;

  const obj =
    typeof user.toObject === "function" ? user.toObject() : { ...user };
  const visibility = obj.profileVisibility || {};

  for (const field of PRIVATE_FIELDS) {
    if (visibility[field] === false) {
      delete obj[field];
    }
  }

  return obj;
}

interface ListUsersQuery {
  page?: string;
  limit?: string;
  batch?: string;
  department?: string;
  session?: string;
  district?: string;
  bloodGroup?: string;
  profession?: string;
  role?: string;
  membershipStatus?: string;
  search?: string;
  isAlumni?: string;
  isAdvisor?: string;
  isSeniorAdvisor?: string;
}

export class UserService {
  /** Public wrapper for controllers that strips private fields per profileVisibility. */
  filterVisibility(user: any, viewerRole?: string): any {
    return applyVisibilityFilter(user, viewerRole);
  }

  async getById(id: string, viewerRole?: string): Promise<any> {
    const user = await User.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
      "skillEndorsements.endorsedBy",
      "name avatar",
    );
    if (!user) throw ApiError.notFound("User not found");
    return applyVisibilityFilter(user, viewerRole);
  }

  /** The one profile write, shared by a member editing their own and a SuperAdmin editing theirs. */
  async updateProfile(
    userId: string,
    rawData: Partial<IUserDocument>,
  ): Promise<IUserDocument> {
    // Strip undefined values (from Zod transforms) so Mongoose doesn't set fields to null.
    const data = JSON.parse(JSON.stringify(rawData));

    // The previous values drive both the group-membership sync and the academic checks below.
    const oldUser = await User.findById(userId)
      .select("department batch session faculty")
      .lean();
    const oldDepartment = oldUser?.department;

    await validateAcademicFields(data, oldUser || {});

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!user) throw ApiError.notFound("User not found");

    // Sync department group membership on change, but only for approved members since the rest join at approval time.
    if (data.department && user.membershipStatus === "approved") {
      const newDept = data.department as string;

      if (oldDepartment && oldDepartment !== newDept) {
        ChatGroup.findOneAndUpdate(
          { type: "department", department: oldDepartment, isDeleted: false },
          { $pull: { members: user._id } },
        )
          .exec()
          .catch(() => {});
      }

      ensureDepartmentGroup(newDept)
        .then(() => {
          ChatGroup.findOneAndUpdate(
            { type: "department", department: newDept, isDeleted: false },
            { $addToSet: { members: user._id } },
          )
            .exec()
            .catch(() => {});
        })
        .catch(() => {});
    }

    // Save explicitly so the pre-save alumni hook runs, unless an admin's manual revoke override is in place.
    if (
      user.membershipStatus === "approved" &&
      !user.alumniManuallyRevoked &&
      (data.jobHistory || data.businessInfo)
    ) {
      const hasCurrentJob = user.jobHistory?.some((j: any) => j.isCurrent);
      const hasCurrentBusiness = user.businessInfo?.some(
        (b: any) => b.isCurrent,
      );
      const wasAlumni = user.isAlumni;

      if (hasCurrentJob || hasCurrentBusiness) {
        // Trigger pre-save hook to recompute isAlumni
        user.alumniAssignment = {
          type: "auto",
          reason: "alumni_auto_detected_current_employment",
          assignedAt: new Date(),
        };
        await user.save();

        if (!wasAlumni && user.isAlumni) {
          await RoleAssignment.create({
            user: user._id,
            role: UserRole.ALUMNI,
            previousRole: user.role,
            assignmentType: "auto",
            reason: "alumni_auto_detected",
          });

          await Notification.create({
            recipient: user._id,
            type: "role_changed",
            title: "Alumni Status Assigned",
            message:
              "You have been classified as an Alumni based on your current employment or business.",
            link: "/dashboard",
          });
        }
      } else if (wasAlumni && !user.alumniApproved) {
        // The current job or business is gone, so pre-save clears isAlumni unless form approval made it sticky.
        await user.save();
      }
    }

    return user;
  }

  /** Only a SuperAdmin may edit someone else's profile; everyone else edits their own via updateProfile. */
  async adminUpdateUser(
    targetUserId: string,
    data: Record<string, any>,
    adminUser: IUserDocument,
  ): Promise<IUserDocument> {
    if (adminUser.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden("Only a SuperAdmin can edit a user's profile");
    }

    const target = await User.findById(targetUserId).select("isDeleted");
    if (!target) throw ApiError.notFound("User not found");
    if (target.isDeleted) {
      throw ApiError.badRequest("Cannot edit a deleted user");
    }

    // Defence in depth: the route's Zod schema already strips these, but the service is callable directly.
    const safeData = { ...data };
    for (const field of PROTECTED_ADMIN_EDIT_FIELDS) delete safeData[field];

    // Reuse the self-edit path so academic validation, department group sync and the alumni hook all still run.
    return this.updateProfile(targetUserId, safeData as Partial<IUserDocument>);
  }

  /** The one query behind both the listing and its export, so a page exports exactly what it shows. */
  private buildUserFilter(query: ListUsersQuery, onlyDeleted = false) {
    // `$ne: true` rather than `false`, so accounts predating the soft-delete flag are still listed.
    const filter: FilterQuery<IUserDocument> = {
      isDeleted: onlyDeleted ? true : { $ne: true },
    };

    if (query.batch) filter.batch = parseInt(query.batch, 10);
    if (query.department) filter.department = query.department;
    if (query.session) filter.session = query.session;
    if (query.district) filter["permanentAddress.district"] = query.district;
    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.profession)
      filter.profession = {
        $regex: escapeRegex(query.profession),
        $options: "i",
      };

    // Flag-based filters (alumni/advisor/senior_advisor are tags, not role tiers)
    if (query.isAlumni === "true") filter.isAlumni = true;
    if (query.isAdvisor === "true") filter.isAdvisor = true;
    if (query.isSeniorAdvisor === "true") filter.isSeniorAdvisor = true;

    if (query.role) {
      // Backward compatibility: map legacy role=alumni/advisor/senior_advisor to flag filters
      if (query.role === UserRole.ALUMNI) {
        filter.isAlumni = true;
      } else if (query.role === UserRole.ADVISOR) {
        filter.isAdvisor = true;
      } else if (query.role === UserRole.SENIOR_ADVISOR) {
        filter.isSeniorAdvisor = true;
      } else {
        filter.role = query.role;
      }
    }
    if (query.membershipStatus)
      filter.membershipStatus = query.membershipStatus;
    if (query.search) {
      const term = escapeRegex(query.search);
      const searchCondition = {
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { studentId: { $regex: term, $options: "i" } },
          { profession: { $regex: term, $options: "i" } },
        ],
      };
      filter.$and = [...(filter.$and || []), searchCondition];
    }

    return filter;
  }

  async listUsers(query: ListUsersQuery, includeDeleted = false) {
    const { page, limit } = parsePagination(query);
    const filter = this.buildUserFilter(query, includeDeleted);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "-password -refreshTokens -emailVerificationToken -passwordResetToken -otp",
        )
        .sort({ createdAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return { users, total, page, limit };
  }

  async restoreUser(targetUserId: string): Promise<IUserDocument> {
    const target = await User.findById(targetUserId).select("+refreshTokens");
    if (!target) throw ApiError.notFound("User not found");
    if (!target.isDeleted) throw ApiError.badRequest("User is not deleted");
    if (target.role === UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden("Cannot restore a SuperAdmin account");
    }

    target.isDeleted = false;
    target.isActive = true;
    target.deletedAt = undefined;
    // Force a fresh login after restoration; any token issued before deletion is stale.
    target.refreshTokens = [];
    await target.save();
    const restored = await User.findById(target._id).select(
      "-password -refreshTokens -emailVerificationToken -passwordResetToken -otp",
    );
    if (!restored) throw ApiError.notFound("User not found");
    return restored;
  }

  async listMembers(query: ListUsersQuery) {
    return this.listUsers({ ...query, role: undefined });
  }

  async listBloodDonors(query: {
    bloodGroup?: string;
    presentDistrict?: string;
    presentDivision?: string;
    district?: string;
    page?: string;
    limit?: string;
  }) {
    const { page, limit } = parsePagination(query);
    // An emergency needs every donor it can reach, so approval is not asked for, only a reachable account.
    const filter: FilterQuery<IUserDocument> = {
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      isBloodDonor: true,
      role: { $ne: UserRole.GUEST },
      membershipStatus: { $ne: "suspended" },
    };

    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.presentDistrict)
      filter["presentAddress.district"] = query.presentDistrict;
    if (query.presentDivision)
      filter["presentAddress.division"] = query.presentDivision;
    if (query.district) filter["permanentAddress.district"] = query.district;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "name avatar bloodGroup permanentAddress presentAddress phone lastDonationDate",
        )
        .skip(getSkip({ page, limit }))
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return { users, total, page, limit };
  }

  async endorseSkill(
    targetUserId: string,
    skill: string,
    endorserId: string,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    if (target._id.toString() === endorserId) {
      throw ApiError.badRequest("Cannot endorse your own skill");
    }

    if (!target.skills.includes(skill)) {
      throw ApiError.badRequest("User does not have this skill");
    }

    const alreadyEndorsed = target.skillEndorsements?.some(
      (e) => e.skill === skill && e.endorsedBy.toString() === endorserId,
    );
    if (alreadyEndorsed) {
      throw ApiError.badRequest("You have already endorsed this skill");
    }

    target.skillEndorsements.push({
      skill,
      endorsedBy: endorserId as any,
      endorsedAt: new Date(),
    });
    await target.save();

    const endorser = await User.findById(endorserId).select("name").lean();
    const endorserName = endorser?.name || "A member";

    await Notification.create({
      recipient: target._id,
      type: "skill_endorsed",
      title: "Skill Endorsed",
      message: `${endorserName} endorsed your skill: ${skill}`,
      link: "/dashboard/profile",
      // The client turns the leading name into a link to the endorser's profile.
      metadata: { actorId: endorserId, actorName: endorserName, skill },
    });

    return target;
  }

  async removeEndorsement(
    targetUserId: string,
    skill: string,
    endorserId: string,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    const idx = target.skillEndorsements?.findIndex(
      (e) => e.skill === skill && e.endorsedBy.toString() === endorserId,
    );
    if (idx === undefined || idx === -1) {
      throw ApiError.notFound("Endorsement not found");
    }

    target.skillEndorsements.splice(idx, 1);
    await target.save();
    return target;
  }

  /** Exports whatever the caller's filters select, which for an unfiltered call is every user. */
  async exportDirectory(
    format: "json" | "csv",
    filters?: ListUsersQuery,
    includeDeleted = false,
  ) {
    const query = this.buildUserFilter(filters || {}, includeDeleted);
    const users = await User.find(query)
      .select(
        "name nameBn email phone studentId registrationNumber faculty department batch session permanentAddress gender bloodGroup isBloodDonor profession earningSource skills role membershipStatus profileVisibility createdAt",
      )
      .sort({ name: 1 })
      .lean();

    // Respect profileVisibility: hide fields users marked as private
    const safeVal = (user: any, field: string, fallback = "") => {
      const vis = user.profileVisibility || {};
      // If visibility is explicitly false (private), hide the value
      if (vis[field] === false) return "";
      return user[field] || fallback;
    };

    if (format === "csv") {
      const headers = [
        "Name",
        "Name (Bn)",
        "Email",
        "Phone",
        "Student ID",
        "Reg No.",
        "Faculty",
        "Department",
        "Batch",
        "Session",
        "District",
        "Gender",
        "Blood Group",
        "Blood Donor",
        "Profession",
        "Earning Source",
        "Skills",
        "Role",
        "Joined",
      ];
      const rows = users.map((u: any) => [
        u.name,
        u.nameBn || "",
        safeVal(u, "email"),
        safeVal(u, "phone"),
        safeVal(u, "studentId"),
        safeVal(u, "registrationNumber"),
        u.faculty || "",
        u.department || "",
        u.batch || "",
        u.session || "",
        u.permanentAddress?.district || "",
        u.gender || "",
        safeVal(u, "bloodGroup"),
        u.isBloodDonor ? "Yes" : "No",
        u.profession || "",
        u.earningSource || "",
        (u.skills || []).join("; "),
        u.role,
        u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "",
      ]);
      const csvLines = [
        headers.join(","),
        ...rows.map((r: string[]) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
        ),
      ];
      return csvLines.join("\n");
    }

    // Strip private fields from JSON export too
    return users.map((u: any) => {
      const vis = u.profileVisibility || {};
      const clean = { ...u };
      for (const field of PRIVATE_FIELDS) {
        if (vis[field] === false) delete clean[field];
      }
      delete clean.profileVisibility;
      return clean;
    });
  }

  async changeRole(
    targetUserId: string,
    newRole: string,
    assignedBy: IUserDocument,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    // Tier-only roles: alumni/advisor/senior_advisor are TAGS (managed via separate endpoints)
    const ALLOWED_TIER_ROLES = [
      UserRole.GUEST,
      UserRole.USER,
      UserRole.MEMBER,
      UserRole.MODERATOR,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ];
    if (!ALLOWED_TIER_ROLES.includes(newRole as UserRole)) {
      throw ApiError.badRequest(
        "Alumni, Advisor, and Senior Advisor are tags, not tier roles. Use the grant endpoints.",
      );
    }

    // Cannot change SuperAdmin role
    if (SUPER_ADMIN_EMAILS.includes(target.email)) {
      throw ApiError.forbidden("Cannot change SuperAdmin role");
    }

    // Only SuperAdmin can assign Admin role
    if (
      newRole === UserRole.ADMIN &&
      assignedBy.role !== UserRole.SUPER_ADMIN
    ) {
      throw ApiError.forbidden("Only SuperAdmin can assign Admin role");
    }

    const previousRole = target.role;
    target.role = newRole;

    if (newRole === UserRole.MODERATOR) {
      target.isModerator = true;
      target.moderatorAssignment = {
        type: "manual",
        reason: "manual_assignment",
        assignedBy: assignedBy._id as any,
        assignedAt: new Date(),
      };
    } else if (
      previousRole === UserRole.MODERATOR &&
      newRole !== UserRole.ADMIN &&
      newRole !== UserRole.SUPER_ADMIN
    ) {
      // Demoting from Moderator: clean up moderator flag
      target.isModerator = false;
      target.moderatorAssignment = undefined;
    }

    // Sync membership status with the new tier role
    const newRoleIdx = ROLE_HIERARCHY.indexOf(newRole as UserRole);
    const memberIdx = ROLE_HIERARCHY.indexOf(UserRole.MEMBER);
    const becomesMemberOrAbove = newRoleIdx >= memberIdx;
    const wasApproved = target.membershipStatus === "approved";
    let justApproved = false;
    let justDemoted = false;

    if (becomesMemberOrAbove && !wasApproved) {
      // Promote: mark membership approved
      target.membershipStatus = "approved";
      target.memberApprovedBy = assignedBy._id as any;
      target.memberApprovedAt = new Date();
      target.memberRejectionReason = undefined;
      target.suspensionReason = undefined;
      target.suspendedAt = undefined;
      target.suspendedBy = undefined;
      justApproved = true;
    } else if (!becomesMemberOrAbove && wasApproved) {
      // Demote below member: revert membership
      target.membershipStatus = "none";
      target.memberApprovedBy = undefined;
      target.memberApprovedAt = undefined;
      justDemoted = true;
    }

    await target.save();

    // When promoted to member via role change, auto-add to central + department groups
    if (justApproved) {
      await ensureCentralGroup();
      await ChatGroup.findOneAndUpdate(
        { type: "central", isDeleted: false },
        { $addToSet: { members: target._id } },
      );
      if (target.department) {
        await ensureDepartmentGroup(target.department);
        await ChatGroup.findOneAndUpdate(
          {
            type: "department",
            department: target.department,
            isDeleted: false,
          },
          { $addToSet: { members: target._id } },
        );
      }
    }

    // Demotion below Member removes the central and department groups, leaving custom and consultation groups intact.
    if (justDemoted) {
      await ChatGroup.findOneAndUpdate(
        { type: "central", isDeleted: false },
        { $pull: { members: target._id, admins: target._id } },
      );
      if (target.department) {
        await ChatGroup.findOneAndUpdate(
          {
            type: "department",
            department: target.department,
            isDeleted: false,
          },
          { $pull: { members: target._id, admins: target._id } },
        );
      }
    }

    // Record role assignment history
    await RoleAssignment.create({
      user: target._id,
      role: newRole,
      previousRole,
      assignmentType: "manual",
      reason: "manual_assignment",
      assignedBy: assignedBy._id,
    });

    // Notify user
    await Notification.create({
      recipient: target._id,
      type: "role_changed",
      title: "Role Updated",
      message: `Your role has been changed from ${previousRole} to ${newRole}`,
      link: "/dashboard",
    });

    return target;
  }

  /** Manually grant or revoke alumni status, where a revoke sets a sticky override so later profile saves never auto-re-tag the user. */
  async setAlumni(
    targetUserId: string,
    grant: boolean,
    adminUser: IUserDocument,
    reason?: string,
    source: "form" | "manual" = "manual",
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    if (grant && target.membershipStatus !== "approved") {
      throw ApiError.badRequest(
        "User must be an approved member before becoming an alumni",
      );
    }

    // No-op detection: already in the desired state?
    if (
      grant &&
      target.isAlumni &&
      target.alumniApproved &&
      !target.alumniManuallyRevoked
    )
      return target;
    if (!grant && !target.isAlumni && target.alumniManuallyRevoked)
      return target;

    const wasAlumni = target.isAlumni;
    if (grant) {
      target.alumniApproved = true;
      target.alumniManuallyRevoked = false;
      target.alumniAssignment = {
        type: source,
        reason:
          reason ||
          (source === "form" ? "alumni_form_approved" : "manual_alumni_grant"),
        assignedBy: adminUser._id as any,
        assignedAt: new Date(),
      };
    } else {
      target.alumniApproved = false;
      target.alumniManuallyRevoked = true;
      target.alumniAssignment = {
        type: "manual",
        reason: reason || "manual_alumni_revoke",
        assignedBy: adminUser._id as any,
        assignedAt: new Date(),
      };
    }
    await target.save(); // pre-save hook recomputes isAlumni

    await RoleAssignment.create({
      user: target._id,
      role: target.isAlumni ? UserRole.ALUMNI : UserRole.MEMBER,
      previousRole: wasAlumni ? UserRole.ALUMNI : UserRole.MEMBER,
      assignmentType: "manual",
      reason:
        reason || (grant ? "manual_alumni_grant" : "manual_alumni_revoke"),
      assignedBy: adminUser._id,
    });

    const nowAlumni = target.isAlumni;
    if (grant && !wasAlumni && nowAlumni) {
      await Notification.create({
        recipient: target._id,
        type: "role_changed",
        title: "Alumni Status Approved",
        message: "You have been classified as an Alumni.",
        link: "/dashboard",
      });
    } else if (!grant && wasAlumni && !nowAlumni) {
      await Notification.create({
        recipient: target._id,
        type: "role_changed",
        title: "Alumni Status Revoked",
        message: "Your Alumni status has been revoked by an administrator.",
        link: "/dashboard",
      });
    }

    return target;
  }

  /** Approve an alumni form submission, delegating to setAlumni with the 'form' source. */
  async approveAlumniForm(
    targetUserId: string,
    approvedBy: IUserDocument,
    reason = "alumni_form_approved",
  ): Promise<IUserDocument> {
    return this.setAlumni(targetUserId, true, approvedBy, reason, "form");
  }

  /** Manually grant or revoke the Advisor flag on an approved member. */
  async setAdvisor(
    targetUserId: string,
    grant: boolean,
    adminUser: IUserDocument,
    reason = grant ? "manual_advisor_grant" : "manual_advisor_revoke",
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    if (grant && target.membershipStatus !== "approved") {
      throw ApiError.badRequest(
        "User must be an approved member before becoming an advisor",
      );
    }

    if (target.isAdvisor === grant) return target; // no-op

    target.isAdvisor = grant;
    if (grant) {
      target.advisorAssignment = {
        type: "manual",
        reason,
        assignedBy: adminUser._id as any,
        assignedAt: new Date(),
      };
    } else {
      target.advisorAssignment = undefined;
    }
    await target.save();

    await RoleAssignment.create({
      user: target._id,
      role: grant ? UserRole.ADVISOR : target.role,
      previousRole: grant ? target.role : UserRole.ADVISOR,
      assignmentType: "manual",
      reason,
      assignedBy: adminUser._id,
    });

    await Notification.create({
      recipient: target._id,
      type: "role_changed",
      title: grant ? "Advisor Role Granted" : "Advisor Role Revoked",
      message: grant
        ? "You have been granted the Advisor tag by an administrator."
        : "Your Advisor tag has been removed by an administrator.",
      link: "/dashboard",
    });

    return target;
  }

  /** Manually grant or revoke the manual-only Senior Advisor flag on an approved member. */
  async setSeniorAdvisor(
    targetUserId: string,
    grant: boolean,
    adminUser: IUserDocument,
    reason = grant
      ? "manual_senior_advisor_grant"
      : "manual_senior_advisor_revoke",
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    // Senior Advisor has no membership gate, any user can hold this tag.

    if (target.isSeniorAdvisor === grant) return target; // no-op

    target.isSeniorAdvisor = grant;
    if (grant) {
      target.seniorAdvisorAssignment = {
        reason,
        assignedBy: adminUser._id as any,
        assignedAt: new Date(),
      };
    } else {
      target.seniorAdvisorAssignment = undefined;
    }
    await target.save();

    await RoleAssignment.create({
      user: target._id,
      role: grant ? UserRole.SENIOR_ADVISOR : target.role,
      previousRole: grant ? target.role : UserRole.SENIOR_ADVISOR,
      assignmentType: "manual",
      reason,
      assignedBy: adminUser._id,
    });

    await Notification.create({
      recipient: target._id,
      type: "role_changed",
      title: grant
        ? "Senior Advisor Role Granted"
        : "Senior Advisor Role Revoked",
      message: grant
        ? "You have been granted the Senior Advisor tag by an administrator."
        : "Your Senior Advisor tag has been removed by an administrator.",
      link: "/dashboard",
    });

    return target;
  }

  async approveMembership(
    targetUserId: string,
    approvedBy: IUserDocument,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");
    if (
      !["pending", "rejected", "suspended"].includes(target.membershipStatus)
    ) {
      throw ApiError.badRequest(
        "User does not have a pending, rejected, or suspended membership",
      );
    }

    target.membershipStatus = "approved";
    target.role = UserRole.MEMBER;
    target.memberApprovedBy = approvedBy._id as any;
    target.memberApprovedAt = new Date();
    await target.save();

    // Send notification via centralized service (handles preferences/DND/socket/email/push)
    await notificationService.send({
      recipientId: target._id,
      type: "member_approved",
      title: "Membership Approved",
      message: "Your RDSWA membership has been approved!",
      link: "/dashboard",
      force: true, // Important notification, bypass DND
    });

    // Auto-add to central RDSWA group (creates it with full seeding if missing)
    await ensureCentralGroup();
    await ChatGroup.findOneAndUpdate(
      { type: "central", isDeleted: false },
      { $addToSet: { members: target._id } },
    );

    // Auto-add to department group (creates it with full seeding if missing)
    if (target.department) {
      await ensureDepartmentGroup(target.department);
      await ChatGroup.findOneAndUpdate(
        { type: "department", department: target.department, isDeleted: false },
        { $addToSet: { members: target._id } },
      );
    }

    return target;
  }

  async rejectMembership(
    targetUserId: string,
    reason?: string,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");
    if (target.membershipStatus !== "pending") {
      throw ApiError.badRequest(
        "User does not have a pending membership application",
      );
    }

    target.membershipStatus = "rejected";
    target.memberRejectionReason = reason || "Application rejected";
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: "member_rejected",
      title: "Membership Rejected",
      message: reason || "Your RDSWA membership application has been rejected.",
      link: "/dashboard",
    });

    return target;
  }

  async suspendUser(
    targetUserId: string,
    reason: string,
    suspendedBy: IUserDocument,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    if (SUPER_ADMIN_EMAILS.includes(target.email)) {
      throw ApiError.forbidden("Cannot suspend a SuperAdmin");
    }

    target.membershipStatus = "suspended";
    target.suspensionReason = reason;
    target.suspendedAt = new Date();
    target.suspendedBy = suspendedBy._id as any;
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: "system",
      title: "Account Suspended",
      message: `Your account has been suspended. Reason: ${reason}`,
      link: "/dashboard",
    });

    return target;
  }

  async unsuspendUser(
    targetUserId: string,
    unsuspendedBy: IUserDocument,
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound("User not found");

    if (target.membershipStatus !== "suspended") {
      throw ApiError.badRequest("User is not suspended");
    }

    target.membershipStatus = "approved";
    target.suspensionReason = undefined;
    target.suspendedAt = undefined;
    target.suspendedBy = undefined;
    // Restore appropriate role
    target.role = resolveBaseRole(target);
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: "system",
      title: "Account Reinstated",
      message:
        "Your account suspension has been lifted. You can now access all member features.",
      link: "/dashboard",
    });

    return target;
  }
}

export const userService = new UserService();
