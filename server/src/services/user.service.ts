import { User, IUserDocument, RoleAssignment, Notification, ChatGroup } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';
import { resolveBaseRole } from '../utils/resolveBaseRole';
import { SUPER_ADMIN_EMAILS } from '../config/constants';
import { FilterQuery } from 'mongoose';
import { notificationService } from './notification.service';
import { ensureDepartmentGroup } from '../jobs/groupInitializer';

/** Fields that can be marked private by users */
const PRIVATE_FIELDS = [
  'phone', 'email', 'dateOfBirth', 'nid',
  'presentAddress', 'permanentAddress', 'bloodGroup',
  'studentId', 'registrationNumber', 'facebook', 'linkedin',
] as const;

/** Check if a role is at least Moderator level */
function isModeratorOrAbove(role: string): boolean {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  const modIdx = ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
  return idx >= modIdx;
}

/** Check if a role is at least Admin level */
function isAdminOrAbove(role: string): boolean {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  const adminIdx = ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
  return idx >= adminIdx;
}

/**
 * Strip private fields from a user object based on their profileVisibility settings.
 * Moderator+ can see all fields regardless.
 */
function applyVisibilityFilter(user: any, viewerRole?: string): any {
  if (!user) return user;
  // Moderator+ sees everything
  if (viewerRole && isModeratorOrAbove(viewerRole)) return user;

  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  const visibility = obj.profileVisibility || {};

  for (const field of PRIVATE_FIELDS) {
    // If visibility[field] is explicitly false (private), hide it
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
  homeDistrict?: string;
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
  async getById(id: string, viewerRole?: string): Promise<any> {
    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) throw ApiError.notFound('User not found');
    return applyVisibilityFilter(user, viewerRole);
  }

  async updateProfile(userId: string, rawData: Partial<IUserDocument>): Promise<IUserDocument> {
    // Strip undefined values (from Zod transforms) so Mongoose doesn't set fields to null
    const data = JSON.parse(JSON.stringify(rawData));

    // Fetch old department before updating (for group membership management)
    const oldUser = data.department ? await User.findById(userId).select('department').lean() : null;
    const oldDepartment = oldUser?.department;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!user) throw ApiError.notFound('User not found');

    // Auto-create department group + add user if department was set/changed
    if (data.department) {
      const newDept = data.department as string;

      // Remove from old department group if department changed
      if (oldDepartment && oldDepartment !== newDept) {
        ChatGroup.findOneAndUpdate(
          { type: 'department', department: oldDepartment, isDeleted: false },
          { $pull: { members: user._id } }
        ).exec().catch(() => {});
      }

      // Add to new department group
      ensureDepartmentGroup(newDept).then(() => {
        ChatGroup.findOneAndUpdate(
          { type: 'department', department: newDept, isDeleted: false },
          { $addToSet: { members: user._id } }
        ).exec().catch(() => {});
      }).catch(() => {});
    }

    // Instant alumni detection — when an approved member adds current job/business,
    // the pre-save hook flips isAlumni. We trigger a save here (findByIdAndUpdate bypasses hooks)
    // and emit a notification + audit log on the 0 → 1 transition.
    if (
      user.membershipStatus === 'approved' &&
      (data.jobHistory || data.businessInfo)
    ) {
      const hasCurrentJob = user.jobHistory?.some((j: any) => j.isCurrent);
      const hasCurrentBusiness = user.businessInfo?.some((b: any) => b.isCurrent);
      const wasAlumni = user.isAlumni;

      if (hasCurrentJob || hasCurrentBusiness) {
        // Trigger pre-save hook to recompute isAlumni
        user.alumniAssignment = {
          type: 'auto',
          reason: 'alumni_auto_detected_current_employment',
          assignedAt: new Date(),
        };
        await user.save();

        if (!wasAlumni && user.isAlumni) {
          await RoleAssignment.create({
            user: user._id,
            role: UserRole.ALUMNI,
            previousRole: user.role,
            assignmentType: 'auto',
            reason: 'alumni_auto_detected',
          });

          await Notification.create({
            recipient: user._id,
            type: 'role_changed',
            title: 'Alumni Status Assigned',
            message: 'You have been classified as an Alumni based on your current employment or business.',
            link: '/dashboard',
          });
        }
      } else if (wasAlumni && !user.alumniApproved) {
        // User removed their current job/business — recompute (pre-save will clear isAlumni
        // unless alumniApproved sticky flag is set via form approval)
        await user.save();
      }
    }

    return user;
  }

  /**
   * Admin+ can update any user's profile fields.
   */
  async adminUpdateUser(targetUserId: string, data: Record<string, any>, adminUser: IUserDocument): Promise<IUserDocument> {
    if (!isAdminOrAbove(adminUser.role)) {
      throw ApiError.forbidden('Only Admin or SuperAdmin can edit other users');
    }

    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    // Prevent editing SuperAdmin unless you are SuperAdmin
    if (SUPER_ADMIN_EMAILS.includes(target.email) && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Cannot edit SuperAdmin profile');
    }

    // Disallow changing sensitive auth fields
    delete data.password;
    delete data.refreshTokens;
    delete data.role;
    delete data.emailVerificationToken;
    delete data.passwordResetToken;
    delete data.otp;

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!updated) throw ApiError.notFound('User not found');
    return updated;
  }

  async listUsers(query: ListUsersQuery) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IUserDocument> = { isDeleted: false };

    if (query.batch) filter.batch = parseInt(query.batch, 10);
    if (query.department) filter.department = query.department;
    if (query.session) filter.session = query.session;
    if (query.homeDistrict) filter.homeDistrict = query.homeDistrict;
    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.profession) filter.profession = { $regex: query.profession, $options: 'i' };

    // Flag-based filters (alumni/advisor/senior_advisor are tags, not role tiers)
    if (query.isAlumni === 'true') filter.isAlumni = true;
    if (query.isAdvisor === 'true') filter.isAdvisor = true;
    if (query.isSeniorAdvisor === 'true') filter.isSeniorAdvisor = true;

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
    if (query.membershipStatus) filter.membershipStatus = query.membershipStatus;
    if (query.search) {
      const searchCondition = {
        $or: [
          { name: { $regex: query.search, $options: 'i' } },
          { email: { $regex: query.search, $options: 'i' } },
          { studentId: { $regex: query.search, $options: 'i' } },
          { profession: { $regex: query.search, $options: 'i' } },
        ],
      };
      filter.$and = [...(filter.$and || []), searchCondition];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken -otp')
        .sort({ createdAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return { users, total, page, limit };
  }

  async listMembers(query: ListUsersQuery) {
    return this.listUsers({ ...query, role: undefined });
  }

  async listBloodDonors(query: { bloodGroup?: string; homeDistrict?: string; page?: string; limit?: string }) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IUserDocument> = {
      isDeleted: false,
      isBloodDonor: true,
      membershipStatus: 'approved',
    };

    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.homeDistrict) filter.homeDistrict = query.homeDistrict;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name avatar bloodGroup homeDistrict phone lastDonationDate')
        .skip(getSkip({ page, limit }))
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return { users, total, page, limit };
  }

  async endorseSkill(
    targetUserId: string,
    skill: string,
    endorserId: string
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (target._id.toString() === endorserId) {
      throw ApiError.badRequest('Cannot endorse your own skill');
    }

    if (!target.skills.includes(skill)) {
      throw ApiError.badRequest('User does not have this skill');
    }

    const alreadyEndorsed = target.skillEndorsements?.some(
      (e) => e.skill === skill && e.endorsedBy.toString() === endorserId
    );
    if (alreadyEndorsed) {
      throw ApiError.badRequest('You have already endorsed this skill');
    }

    target.skillEndorsements.push({
      skill,
      endorsedBy: endorserId as any,
      endorsedAt: new Date(),
    });
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'skill_endorsed',
      title: 'Skill Endorsed',
      message: `Someone endorsed your skill: ${skill}`,
      link: '/dashboard/profile',
    });

    return target;
  }

  async removeEndorsement(
    targetUserId: string,
    skill: string,
    endorserId: string
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    const idx = target.skillEndorsements?.findIndex(
      (e) => e.skill === skill && e.endorsedBy.toString() === endorserId
    );
    if (idx === undefined || idx === -1) {
      throw ApiError.notFound('Endorsement not found');
    }

    target.skillEndorsements.splice(idx, 1);
    await target.save();
    return target;
  }

  async exportDirectory(format: 'json' | 'csv', filters?: { role?: string; membershipStatus?: string; search?: string }) {
    const query: FilterQuery<IUserDocument> = { isDeleted: false };
    if (filters?.role) query.role = filters.role;
    if (filters?.membershipStatus) query.membershipStatus = filters.membershipStatus;
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { studentId: { $regex: filters.search, $options: 'i' } },
      ];
    }
    // If no filters at all, default to approved members
    if (!filters?.role && !filters?.membershipStatus && !filters?.search) {
      query.membershipStatus = 'approved';
    }
    const users = await User.find(query)
      .select('name nameBn email phone studentId registrationNumber faculty department batch session homeDistrict gender bloodGroup isBloodDonor profession earningSource skills role membershipStatus profileVisibility createdAt')
      .sort({ name: 1 })
      .lean();

    // Respect profileVisibility — hide fields users marked as private
    const safeVal = (user: any, field: string, fallback = '') => {
      const vis = user.profileVisibility || {};
      // If visibility is explicitly false (private), hide the value
      if (vis[field] === false) return '';
      return user[field] || fallback;
    };

    if (format === 'csv') {
      const headers = ['Name', 'Name (Bn)', 'Email', 'Phone', 'Student ID', 'Reg No.', 'Faculty', 'Department', 'Batch', 'Session', 'District', 'Gender', 'Blood Group', 'Blood Donor', 'Profession', 'Earning Source', 'Skills', 'Role', 'Joined'];
      const rows = users.map((u: any) => [
        u.name, u.nameBn || '',
        safeVal(u, 'email'), safeVal(u, 'phone'),
        safeVal(u, 'studentId'), safeVal(u, 'registrationNumber'),
        u.faculty || '', u.department || '', u.batch || '', u.session || '',
        u.homeDistrict || '', u.gender || '',
        safeVal(u, 'bloodGroup'), u.isBloodDonor ? 'Yes' : 'No',
        u.profession || '', u.earningSource || '',
        (u.skills || []).join('; '), u.role,
        u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
      ]);
      const csvLines = [headers.join(','), ...rows.map((r: string[]) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))];
      return csvLines.join('\n');
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
    assignedBy: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    // Cannot change SuperAdmin role
    if (SUPER_ADMIN_EMAILS.includes(target.email)) {
      throw ApiError.forbidden('Cannot change SuperAdmin role');
    }

    // Only SuperAdmin can assign Admin role
    if (newRole === UserRole.ADMIN && assignedBy.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Only SuperAdmin can assign Admin role');
    }

    const previousRole = target.role;
    target.role = newRole;

    if (newRole === UserRole.MODERATOR) {
      target.isModerator = true;
      target.moderatorAssignment = {
        type: 'manual',
        reason: 'manual_assignment',
        assignedBy: assignedBy._id as any,
        assignedAt: new Date(),
      };
    } else if (
      previousRole === UserRole.MODERATOR &&
      newRole !== UserRole.ADMIN &&
      newRole !== UserRole.SUPER_ADMIN
    ) {
      // Demoting from Moderator — clean up moderator flag
      target.isModerator = false;
      target.moderatorAssignment = undefined;
    }

    await target.save();

    // Record role assignment history
    await RoleAssignment.create({
      user: target._id,
      role: newRole,
      previousRole,
      assignmentType: 'manual',
      reason: 'manual_assignment',
      assignedBy: assignedBy._id,
    });

    // Notify user
    await Notification.create({
      recipient: target._id,
      type: 'role_changed',
      title: 'Role Updated',
      message: `Your role has been changed from ${previousRole} to ${newRole}`,
      link: '/dashboard',
    });

    return target;
  }

  /**
   * Revoke the sticky alumniApproved flag. The pre-save hook will recompute
   * isAlumni — if the user still has a current job/business, they remain alumni.
   */
  async revokeAlumniApproved(
    targetUserId: string,
    adminUser: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (!target.alumniApproved) {
      throw ApiError.badRequest('User does not have an approved alumni form');
    }

    target.alumniApproved = false;
    target.alumniAssignment = undefined;
    await target.save();

    await RoleAssignment.create({
      user: target._id,
      role: target.isAlumni ? UserRole.ALUMNI : UserRole.MEMBER,
      previousRole: UserRole.ALUMNI,
      assignmentType: 'manual',
      reason: 'alumni_approved_revoked',
      assignedBy: adminUser._id,
    });

    return target;
  }

  /**
   * Approve an alumni form submission — sets the sticky alumniApproved flag.
   * Gate: target must be an approved member.
   */
  async approveAlumniForm(
    targetUserId: string,
    approvedBy: IUserDocument,
    reason = 'alumni_form_approved'
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (target.membershipStatus !== 'approved') {
      throw ApiError.badRequest('User must be an approved member before becoming an alumni');
    }

    const wasAlumni = target.isAlumni;
    target.alumniApproved = true;
    target.alumniAssignment = {
      type: 'form',
      reason,
      assignedBy: approvedBy._id as any,
      assignedAt: new Date(),
    };
    await target.save(); // pre-save hook flips isAlumni → true

    if (!wasAlumni) {
      await RoleAssignment.create({
        user: target._id,
        role: UserRole.ALUMNI,
        previousRole: target.role,
        assignmentType: 'manual',
        reason,
        assignedBy: approvedBy._id,
      });

      await Notification.create({
        recipient: target._id,
        type: 'role_changed',
        title: 'Alumni Status Approved',
        message: 'Your alumni application has been approved.',
        link: '/dashboard',
      });
    }

    return target;
  }

  /**
   * Manually grant or revoke the Advisor flag.
   * Gate: target must be an approved member.
   */
  async setAdvisor(
    targetUserId: string,
    grant: boolean,
    adminUser: IUserDocument,
    reason = grant ? 'manual_advisor_grant' : 'manual_advisor_revoke'
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (grant && target.membershipStatus !== 'approved') {
      throw ApiError.badRequest('User must be an approved member before becoming an advisor');
    }

    if (target.isAdvisor === grant) return target; // no-op

    target.isAdvisor = grant;
    if (grant) {
      target.advisorAssignment = {
        type: 'manual',
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
      assignmentType: 'manual',
      reason,
      assignedBy: adminUser._id,
    });

    await Notification.create({
      recipient: target._id,
      type: 'role_changed',
      title: grant ? 'Advisor Role Granted' : 'Advisor Role Revoked',
      message: grant
        ? 'You have been granted the Advisor tag by an administrator.'
        : 'Your Advisor tag has been removed by an administrator.',
      link: '/dashboard',
    });

    return target;
  }

  /**
   * Manually grant or revoke the Senior Advisor flag.
   * Gate: target must be an approved member. Senior Advisor is manual-only.
   */
  async setSeniorAdvisor(
    targetUserId: string,
    grant: boolean,
    adminUser: IUserDocument,
    reason = grant ? 'manual_senior_advisor_grant' : 'manual_senior_advisor_revoke'
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (grant && target.membershipStatus !== 'approved') {
      throw ApiError.badRequest('User must be an approved member before becoming a senior advisor');
    }

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
      assignmentType: 'manual',
      reason,
      assignedBy: adminUser._id,
    });

    await Notification.create({
      recipient: target._id,
      type: 'role_changed',
      title: grant ? 'Senior Advisor Role Granted' : 'Senior Advisor Role Revoked',
      message: grant
        ? 'You have been granted the Senior Advisor tag by an administrator.'
        : 'Your Senior Advisor tag has been removed by an administrator.',
      link: '/dashboard',
    });

    return target;
  }

  async approveMembership(
    targetUserId: string,
    approvedBy: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');
    if (!['pending', 'rejected', 'suspended'].includes(target.membershipStatus)) {
      throw ApiError.badRequest('User does not have a pending, rejected, or suspended membership');
    }

    target.membershipStatus = 'approved';
    target.role = UserRole.MEMBER;
    target.memberApprovedBy = approvedBy._id as any;
    target.memberApprovedAt = new Date();
    await target.save();

    // Send notification via centralized service (handles preferences/DND/socket/email/push)
    await notificationService.send({
      recipientId: target._id,
      type: 'member_approved',
      title: 'Membership Approved',
      message: 'Your RDSWA membership has been approved!',
      link: '/dashboard',
      force: true, // Important notification — bypass DND
    });

    // Auto-add to central RDSWA group
    await ChatGroup.findOneAndUpdate(
      { type: 'central', isDeleted: false },
      { $addToSet: { members: target._id } }
    );

    // Auto-add to department group (create if needed)
    if (target.department) {
      let deptGroup = await ChatGroup.findOne({
        type: 'department',
        department: target.department,
        isDeleted: false,
      });
      if (!deptGroup) {
        deptGroup = await ChatGroup.create({
          name: `${target.department} Group`,
          type: 'department',
          department: target.department,
          members: [target._id],
          admins: [],
        });
      } else {
        await ChatGroup.findByIdAndUpdate(deptGroup._id, {
          $addToSet: { members: target._id },
        });
      }
    }

    return target;
  }

  async rejectMembership(
    targetUserId: string,
    reason?: string
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');
    if (target.membershipStatus !== 'pending') {
      throw ApiError.badRequest('User does not have a pending membership application');
    }

    target.membershipStatus = 'rejected';
    target.memberRejectionReason = reason || 'Application rejected';
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'member_rejected',
      title: 'Membership Rejected',
      message: reason || 'Your RDSWA membership application has been rejected.',
      link: '/dashboard',
    });

    return target;
  }

  async suspendUser(
    targetUserId: string,
    reason: string,
    suspendedBy: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (SUPER_ADMIN_EMAILS.includes(target.email)) {
      throw ApiError.forbidden('Cannot suspend a SuperAdmin');
    }

    target.membershipStatus = 'suspended';
    target.suspensionReason = reason;
    target.suspendedAt = new Date();
    target.suspendedBy = suspendedBy._id as any;
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'system',
      title: 'Account Suspended',
      message: `Your account has been suspended. Reason: ${reason}`,
      link: '/dashboard',
    });

    return target;
  }

  async unsuspendUser(
    targetUserId: string,
    unsuspendedBy: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');

    if (target.membershipStatus !== 'suspended') {
      throw ApiError.badRequest('User is not suspended');
    }

    target.membershipStatus = 'approved';
    target.suspensionReason = undefined;
    target.suspendedAt = undefined;
    target.suspendedBy = undefined;
    // Restore appropriate role
    target.role = resolveBaseRole(target);
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'system',
      title: 'Account Reinstated',
      message: 'Your account suspension has been lifted. You can now access all member features.',
      link: '/dashboard',
    });

    return target;
  }
}

export const userService = new UserService();
