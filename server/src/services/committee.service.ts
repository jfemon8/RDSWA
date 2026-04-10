import { Committee, ICommitteeDocument, User, RoleAssignment, Notification } from '../models';
import { ApiError } from '../utils/ApiError';
import { resolveBaseRole } from '../utils/resolveBaseRole';
import { UserRole, MODERATOR_AUTO_POSITIONS, MODERATOR_RETAIN_POSITIONS, CommitteePosition } from '@rdswa/shared';
import mongoose from 'mongoose';

/** Positions that auto-grant the Advisor tag on committee archive */
const ADVISOR_AUTO_POSITIONS: string[] = [
  CommitteePosition.PRESIDENT,
  CommitteePosition.GENERAL_SECRETARY,
];

interface CreateCommitteeInput {
  name: string;
  tenure: { startDate: string; endDate?: string };
  isCurrent?: boolean;
  description?: string;
  members?: Array<{
    user: string;
    position: string;
    positionBn?: string;
    responsibilities?: string;
  }>;
}

export class CommitteeService {
  async getAll() {
    return Committee.find({ isDeleted: false })
      .populate('members.user', 'name avatar department batch')
      .sort({ 'tenure.startDate': -1 });
  }

  async getCurrent() {
    const committee = await Committee.findOne({ isCurrent: true, isDeleted: false })
      .populate('members.user', 'name nameBn avatar department batch phone email');
    if (!committee) throw ApiError.notFound('No current committee found');
    return committee;
  }

  async getById(id: string) {
    const committee = await Committee.findOne({ _id: id, isDeleted: false })
      .populate('members.user', 'name nameBn avatar department batch phone email');
    if (!committee) throw ApiError.notFound('Committee not found');
    return committee;
  }

  async create(input: CreateCommitteeInput, createdBy: string): Promise<ICommitteeDocument> {
    // If marking as current, unset any existing current committee
    if (input.isCurrent) {
      await Committee.updateMany({ isCurrent: true }, { isCurrent: false });
    }

    const committee = await Committee.create({
      ...input,
      tenure: {
        startDate: new Date(input.tenure.startDate),
        endDate: input.tenure.endDate ? new Date(input.tenure.endDate) : undefined,
      },
      members: input.members?.map((m) => ({
        ...m,
        user: new mongoose.Types.ObjectId(m.user),
        joinedAt: new Date(),
      })) || [],
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    // Auto-assign moderator roles to qualifying positions
    if (committee.members.length > 0) {
      await this.assignModeratorRoles(committee);
    }

    return committee;
  }

  async update(id: string, input: Partial<CreateCommitteeInput>): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: id, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    if (input.isCurrent) {
      await Committee.updateMany({ isCurrent: true, _id: { $ne: id } }, { isCurrent: false });
    }

    if (input.name !== undefined) committee.name = input.name;
    if (input.description !== undefined) committee.description = input.description;
    if (input.isCurrent !== undefined) committee.isCurrent = input.isCurrent;
    if (input.tenure) {
      if (input.tenure.startDate) committee.tenure.startDate = new Date(input.tenure.startDate);
      if (input.tenure.endDate) committee.tenure.endDate = new Date(input.tenure.endDate);
    }

    await committee.save();
    return committee;
  }

  async addMember(
    committeeId: string,
    memberInput: { user: string; position: string; positionBn?: string; responsibilities?: string }
  ): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: committeeId, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    // Check if user already in committee
    const existing = committee.members.find(
      (m) => m.user.toString() === memberInput.user && !m.leftAt
    );
    if (existing) throw ApiError.conflict('User is already a member of this committee');

    committee.members.push({
      user: new mongoose.Types.ObjectId(memberInput.user),
      position: memberInput.position,
      positionBn: memberInput.positionBn,
      responsibilities: memberInput.responsibilities,
      joinedAt: new Date(),
    } as any);

    await committee.save();

    // Auto-assign moderator if qualifying position
    if (MODERATOR_AUTO_POSITIONS.includes(memberInput.position)) {
      await this.setModeratorRole(memberInput.user, true, 'auto', memberInput.position);
    }

    return committee;
  }

  async removeMember(committeeId: string, userId: string): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: committeeId, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    const memberEntry = committee.members.find(
      (m) => m.user.toString() === userId && !m.leftAt
    );
    if (!memberEntry) throw ApiError.notFound('Member not found in this committee');

    memberEntry.leftAt = new Date();
    await committee.save();

    // If they had a moderator-qualifying position and committee is current, check retention
    if (committee.isCurrent && MODERATOR_AUTO_POSITIONS.includes(memberEntry.position)) {
      if (!MODERATOR_RETAIN_POSITIONS.includes(memberEntry.position)) {
        // OS, Treasurer lose moderator when removed
        await this.setModeratorRole(userId, false, 'auto', `removed_from_${memberEntry.position}`);
      }
    }

    return committee;
  }

  async archive(id: string): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: id, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    committee.isCurrent = false;
    committee.tenure.endDate = new Date();
    await committee.save();

    // Handle role transitions on archive
    for (const member of committee.members) {
      if (member.leftAt) continue;

      // Ex-president / ex-GS automatically become advisors
      if (ADVISOR_AUTO_POSITIONS.includes(member.position)) {
        await this.grantAdvisorTag(
          member.user.toString(),
          `committee_archived_${member.position}`
        );
      }

      // Moderator transitions: OS/Treasurer lose moderator; President/GS retain per existing rule
      if (MODERATOR_AUTO_POSITIONS.includes(member.position)) {
        if (!MODERATOR_RETAIN_POSITIONS.includes(member.position)) {
          await this.setModeratorRole(
            member.user.toString(),
            false,
            'auto',
            `committee_archived_${member.position}`
          );
        }
      }
    }

    return committee;
  }

  /**
   * Auto-grant the Advisor tag to a user (used on committee archive for ex-president/GS).
   * Idempotent — does nothing if already an advisor.
   */
  private async grantAdvisorTag(userId: string, reason: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;
    if (user.isAdvisor) return;

    user.isAdvisor = true;
    user.advisorAssignment = {
      type: 'auto',
      reason,
      assignedAt: new Date(),
    };
    await user.save();

    await RoleAssignment.create({
      user: user._id,
      role: UserRole.ADVISOR,
      previousRole: user.role,
      assignmentType: 'auto',
      reason,
    });

    await Notification.create({
      recipient: user._id,
      type: 'role_changed',
      title: 'Advisor Role Assigned',
      message: 'You have been classified as an Advisor based on your past committee leadership.',
      link: '/dashboard',
    });
  }

  async delete(id: string): Promise<void> {
    const committee = await Committee.findOne({ _id: id, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    committee.isDeleted = true;
    committee.isCurrent = false;
    await committee.save();
  }

  /**
   * Auto-assign moderator roles to qualifying committee positions.
   */
  private async assignModeratorRoles(committee: ICommitteeDocument): Promise<void> {
    for (const member of committee.members) {
      if (MODERATOR_AUTO_POSITIONS.includes(member.position)) {
        await this.setModeratorRole(member.user.toString(), true, 'auto', member.position);
      }
    }
  }

  /**
   * Set or remove moderator role for a user.
   */
  private async setModeratorRole(
    userId: string,
    grant: boolean,
    type: 'auto' | 'manual',
    reason: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (grant && !user.isModerator) {
      const previousRole = user.role;
      user.isModerator = true;
      if (
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        user.role = UserRole.MODERATOR;
      }
      user.moderatorAssignment = {
        type,
        reason,
        assignedAt: new Date(),
      };
      await user.save();

      await RoleAssignment.create({
        user: user._id,
        role: UserRole.MODERATOR,
        previousRole,
        assignmentType: type,
        reason,
      });

      await Notification.create({
        recipient: user._id,
        type: 'role_changed',
        title: 'Moderator Role Assigned',
        message: `You have been assigned the Moderator role (reason: ${reason})`,
        link: '/dashboard',
      });
    } else if (!grant && user.isModerator) {
      // Check if user still qualifies via another committee
      const activeCommittees = await Committee.find({
        isCurrent: true,
        isDeleted: false,
        'members.user': user._id,
        'members.leftAt': null,
      });

      const stillQualifies = activeCommittees.some((c) =>
        c.members.some(
          (m) =>
            m.user.toString() === userId &&
            !m.leftAt &&
            MODERATOR_AUTO_POSITIONS.includes(m.position)
        )
      );

      if (!stillQualifies && user.moderatorAssignment?.type === 'auto') {
        const previousRole = user.role;
        user.isModerator = false;
        user.moderatorAssignment = undefined;
        if (user.role === UserRole.MODERATOR) {
          user.role = resolveBaseRole(user);
        }
        await user.save();

        await RoleAssignment.create({
          user: user._id,
          role: user.role,
          previousRole,
          assignmentType: 'auto',
          reason: `moderator_removed_${reason}`,
        });

        await Notification.create({
          recipient: user._id,
          type: 'role_changed',
          title: 'Moderator Role Removed',
          message: `Your Moderator role has been removed (reason: ${reason.replace(/_/g, ' ')}). Your role is now ${user.role.replace(/_/g, ' ')}.`,
          link: '/dashboard',
        });
      }
    }
  }
}

export const committeeService = new CommitteeService();
