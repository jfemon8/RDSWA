import { User, IUserDocument, RoleAssignment, Notification } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { UserRole } from '@rdswa/shared';
import { SUPER_ADMIN_EMAILS } from '../config/constants';
import { FilterQuery } from 'mongoose';

interface ListUsersQuery {
  page?: string;
  limit?: string;
  batch?: string;
  department?: string;
  session?: string;
  homeDistrict?: string;
  bloodGroup?: string;
  role?: string;
  search?: string;
}

export class UserService {
  async getById(id: string): Promise<IUserDocument> {
    const user = await User.findOne({ _id: id, isDeleted: false });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateProfile(userId: string, data: Partial<IUserDocument>): Promise<IUserDocument> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async listUsers(query: ListUsersQuery) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IUserDocument> = { isDeleted: false };

    if (query.batch) filter.batch = parseInt(query.batch, 10);
    if (query.department) filter.department = query.department;
    if (query.session) filter.session = query.session;
    if (query.homeDistrict) filter.homeDistrict = query.homeDistrict;
    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.role) filter.role = query.role;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { studentId: { $regex: query.search, $options: 'i' } },
      ];
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

  async approveMembership(
    targetUserId: string,
    approvedBy: IUserDocument
  ): Promise<IUserDocument> {
    const target = await User.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');
    if (target.membershipStatus !== 'pending') {
      throw ApiError.badRequest('User does not have a pending membership application');
    }

    target.membershipStatus = 'approved';
    target.role = UserRole.MEMBER;
    target.memberApprovedBy = approvedBy._id as any;
    target.memberApprovedAt = new Date();
    await target.save();

    await Notification.create({
      recipient: target._id,
      type: 'member_approved',
      title: 'Membership Approved',
      message: 'Your RDSWA membership has been approved!',
      link: '/dashboard',
    });

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

    return target;
  }
}

export const userService = new UserService();
