import { Committee, ICommitteeDocument, User, RoleAssignment, Notification } from '../models';
import { ApiError } from '../utils/ApiError';
import { resolveBaseRole } from '../utils/resolveBaseRole';
import { getAutoRoleConfig } from '../utils/getAutoRoleConfig';
import { UserRole } from '@rdswa/shared';
import mongoose from 'mongoose';

interface CommitteeMemberInput {
  user: string;
  position: string;
  positionBn?: string;
  designation?: string;
  responsibilities?: string;
}

interface CreateCommitteeInput {
  name: string;
  tenure: { startDate: string; endDate?: string };
  isCurrent?: boolean;
  description?: string;
  members?: CommitteeMemberInput[];
}

/** Turn a stored position slug into the wording used in error messages, e.g. "general_secretary" → "General Secretary". */
function formatPosition(position: string): string {
  return position
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
    const startDate = new Date(input.tenure.startDate);
    const endDate = input.tenure.endDate ? new Date(input.tenure.endDate) : undefined;
    // A committee is current precisely while it has no end date, so at most one may be open at a time.
    const isCurrent = !endDate;

    await this.validateMemberInputs(input.members || []);

    if (isCurrent) await this.closeOpenCommittees(startDate);

    const committee = await Committee.create({
      ...input,
      isCurrent,
      tenure: { startDate, endDate },
      members: input.members?.map((m) => ({
        ...m,
        user: new mongoose.Types.ObjectId(m.user),
        joinedAt: new Date(),
      })) || [],
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    if (committee.members.length > 0) {
      if (committee.isCurrent) {
        // Current committee: assign Admin/Moderator to qualifying positions
        await this.assignAutoRoles(committee);
      } else {
        // Historical committee: grant advisor tags only
        await this.applyArchiveTransitions(committee);
      }
    }

    return committee;
  }

  async update(id: string, input: Partial<CreateCommitteeInput>): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: id, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    const wasCurrent = committee.isCurrent;

    if (input.name !== undefined) committee.name = input.name;
    if (input.description !== undefined) committee.description = input.description;
    if (input.tenure) {
      if (input.tenure.startDate) committee.tenure.startDate = new Date(input.tenure.startDate);
      // An empty end date is a deliberate clear, which reopens this committee as the current one.
      if (input.tenure.endDate !== undefined) {
        // `set` is used so clearing the date unsets the stored field rather than leaving the old value.
        committee.set('tenure.endDate', input.tenure.endDate ? new Date(input.tenure.endDate) : undefined);
      }
    }

    committee.isCurrent = !committee.tenure.endDate;

    if (committee.isCurrent) await this.closeOpenCommittees(committee.tenure.startDate, id);

    await committee.save();

    if (wasCurrent && !committee.isCurrent) {
      await this.applyArchiveTransitions(committee);
    } else if (!wasCurrent && committee.isCurrent) {
      await this.assignAutoRoles(committee);
    }

    return committee;
  }

  /**
   * Close every other open committee so only one sits without an end date, dating each one
   * to the incoming committee's start so the two tenures meet rather than overlap.
   */
  private async closeOpenCommittees(newStartDate: Date, exceptId?: string): Promise<void> {
    const filter: Record<string, unknown> = {
      isDeleted: false,
      $or: [{ isCurrent: true }, { 'tenure.endDate': { $exists: false } }, { 'tenure.endDate': null }],
    };
    if (exceptId) filter._id = { $ne: exceptId };

    const openCommittees = await Committee.find(filter);
    for (const c of openCommittees) {
      c.isCurrent = false;
      if (!c.tenure.endDate) c.tenure.endDate = newStartDate;
      await c.save();
      await this.applyArchiveTransitions(c);
    }
  }

  /**
   * Reject a member list that breaks the one-holder rule — the same user twice, or two people
   * sharing a position that only one member may hold.
   */
  private async validateMemberInputs(members: CommitteeMemberInput[]): Promise<void> {
    if (members.length === 0) return;

    const seenUsers = new Set<string>();
    for (const m of members) {
      if (seenUsers.has(m.user)) throw ApiError.badRequest('The same user cannot be added twice to one committee');
      seenUsers.add(m.user);
    }

    const uniquePositions = await this.uniquePositions();
    const seenPositions = new Set<string>();
    for (const m of members) {
      if (!uniquePositions.includes(m.position)) continue;
      if (seenPositions.has(m.position)) {
        throw ApiError.conflict(`Only one ${formatPosition(m.position)} is allowed in a committee`);
      }
      seenPositions.add(m.position);
    }
  }

  /** Positions only one sitting member may hold, taken from the same config that drives auto-roles. */
  private async uniquePositions(): Promise<string[]> {
    const cfg = await getAutoRoleConfig();
    return cfg.allAutoPositions;
  }

  async addMember(
    committeeId: string,
    memberInput: CommitteeMemberInput
  ): Promise<ICommitteeDocument> {
    const committee = await Committee.findOne({ _id: committeeId, isDeleted: false });
    if (!committee) throw ApiError.notFound('Committee not found');

    const existing = committee.members.find(
      (m) => m.user.toString() === memberInput.user && !m.leftAt
    );
    if (existing) throw ApiError.conflict('User is already a member of this committee');

    // Only sitting members hold a post, so removing one leaves the seat free for anyone — the same person included.
    const uniquePositions = await this.uniquePositions();
    if (uniquePositions.includes(memberInput.position)) {
      const seatTaken = committee.members.some(
        (m) => m.position === memberInput.position && !m.leftAt
      );
      if (seatTaken) {
        throw ApiError.conflict(
          `This committee already has a ${formatPosition(memberInput.position)}. Remove the current one before assigning a new person.`
        );
      }
    }

    committee.members.push({
      user: new mongoose.Types.ObjectId(memberInput.user),
      position: memberInput.position,
      positionBn: memberInput.positionBn,
      designation: memberInput.designation,
      responsibilities: memberInput.responsibilities,
      joinedAt: new Date(),
    } as any);

    await committee.save();

    // Auto-assign role if qualifying position in current committee
    if (committee.isCurrent) {
      const cfg = await getAutoRoleConfig();
      if (cfg.adminPositions.includes(memberInput.position)) {
        await this.setAutoAdminRole(memberInput.user, true, memberInput.position);
      } else if (cfg.moderatorPositions.includes(memberInput.position)) {
        await this.setAutoModeratorRole(memberInput.user, true, memberInput.position);
      }
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

    if (committee.isCurrent) {
      const cfg = await getAutoRoleConfig();
      if (cfg.allAutoPositions.includes(memberEntry.position)) {
        if (cfg.adminPositions.includes(memberEntry.position)) {
          // Admin position removed from current → lose Admin, become Moderator (ex-officer)
          await this.transitionAdminToModerator(userId, `removed_from_${memberEntry.position}`);
        } else {
          // Moderator position removed from current → lose Moderator
          await this.setAutoModeratorRole(userId, false, `removed_from_${memberEntry.position}`);
        }
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

    await this.applyArchiveTransitions(committee);

    return committee;
  }

  /**
   * Apply role transitions for a committee transitioning to archived state.
   *
   * Driven by the editable auto-role config:
   *  - Members at admin-auto positions → lose Admin, become Moderator (ex-officer)
   *  - Members at moderator-auto positions → lose Moderator entirely
   *  - Members at advisor-on-archive positions → gain Advisor tag
   */
  private async applyArchiveTransitions(committee: ICommitteeDocument): Promise<void> {
    const cfg = await getAutoRoleConfig();
    for (const member of committee.members) {
      if (member.leftAt) continue;

      // Advisor tag for configured archive positions
      if (cfg.advisorOnArchivePositions.includes(member.position)) {
        await this.grantAdvisorTag(
          member.user.toString(),
          `committee_archived_${member.position}`
        );
      }

      // Admin position: Admin → Moderator transition
      if (cfg.adminPositions.includes(member.position)) {
        await this.transitionAdminToModerator(
          member.user.toString(),
          `committee_archived_${member.position}`
        );
      }

      // Moderator position: lose Moderator
      if (cfg.moderatorPositions.includes(member.position)) {
        await this.setAutoModeratorRole(
          member.user.toString(),
          false,
          `committee_archived_${member.position}`
        );
      }
    }
  }

  /**
   * Auto-assign roles to qualifying positions in a new current committee,
   * based on the editable auto-role config.
   */
  private async assignAutoRoles(committee: ICommitteeDocument): Promise<void> {
    const cfg = await getAutoRoleConfig();
    for (const member of committee.members) {
      if (cfg.adminPositions.includes(member.position)) {
        await this.setAutoAdminRole(member.user.toString(), true, member.position);
      } else if (cfg.moderatorPositions.includes(member.position)) {
        await this.setAutoModeratorRole(member.user.toString(), true, member.position);
      }
    }
  }

  /** Grant the Admin role from a committee position, also setting isModerator so removal falls back to Moderator. */
  private async setAutoAdminRole(userId: string, grant: boolean, reason: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (grant) {
      if (user.role === UserRole.SUPER_ADMIN) return; // Don't downgrade SuperAdmin

      const previousRole = user.role;
      user.role = UserRole.ADMIN;
      user.isModerator = true;
      user.moderatorAssignment = {
        type: 'auto',
        reason,
        assignedAt: new Date(),
      };
      await user.save();

      await RoleAssignment.create({
        user: user._id,
        role: UserRole.ADMIN,
        previousRole,
        assignmentType: 'auto',
        reason,
      });

      await Notification.create({
        recipient: user._id,
        type: 'role_changed',
        title: 'Admin Role Assigned',
        message: `You have been assigned the Admin role as committee ${reason.replace(/_/g, ' ')}.`,
        link: '/dashboard',
      });
    }
  }

  /** Step an auto-assigned Admin down to Moderator when their committee archives or their post is removed, keeping them as an ex-officer. */
  private async transitionAdminToModerator(userId: string, reason: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    // Only transition if they're currently Admin with auto-assignment
    if (user.role !== UserRole.ADMIN || user.moderatorAssignment?.type !== 'auto') return;

    // Check if user still qualifies as Admin via another current committee
    const cfg = await getAutoRoleConfig();
    const stillAdmin = await this.stillQualifiesForRole(userId, cfg.adminPositions);
    if (stillAdmin) return;

    const previousRole = user.role;
    user.role = UserRole.MODERATOR;
    // isModerator stays true — they retain Moderator as ex-officer
    user.moderatorAssignment = {
      type: 'auto',
      reason: `ex_officer_${reason}`,
      assignedAt: new Date(),
    };
    await user.save();

    await RoleAssignment.create({
      user: user._id,
      role: UserRole.MODERATOR,
      previousRole,
      assignmentType: 'auto',
      reason: `admin_to_moderator_${reason}`,
    });

    await Notification.create({
      recipient: user._id,
      type: 'role_changed',
      title: 'Role Updated to Moderator',
      message: `Your Admin role has been updated to Moderator as an ex-committee officer.`,
      link: '/dashboard',
    });
  }

  /**
   * Grant or revoke Moderator role for a user (auto-assignment for OS/Treasurer).
   */
  private async setAutoModeratorRole(userId: string, grant: boolean, reason: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    if (grant && !user.isModerator) {
      const previousRole = user.role;
      user.isModerator = true;
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        user.role = UserRole.MODERATOR;
      }
      user.moderatorAssignment = {
        type: 'auto',
        reason,
        assignedAt: new Date(),
      };
      await user.save();

      await RoleAssignment.create({
        user: user._id,
        role: UserRole.MODERATOR,
        previousRole,
        assignmentType: 'auto',
        reason,
      });

      await Notification.create({
        recipient: user._id,
        type: 'role_changed',
        title: 'Moderator Role Assigned',
        message: `You have been assigned the Moderator role (reason: ${reason.replace(/_/g, ' ')}).`,
        link: '/dashboard',
      });
    } else if (!grant && user.isModerator) {
      // Check if user still qualifies via another committee
      const cfg = await getAutoRoleConfig();
      const stillModerator = await this.stillQualifiesForRole(userId, cfg.moderatorPositions);
      if (stillModerator) return;

      // Only revoke if assignment was auto
      if (user.moderatorAssignment?.type !== 'auto') return;

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

  /**
   * Check if a user still qualifies for a role via another active committee.
   */
  private async stillQualifiesForRole(userId: string, positions: string[]): Promise<boolean> {
    const activeCommittees = await Committee.find({
      isCurrent: true,
      isDeleted: false,
      'members.user': new mongoose.Types.ObjectId(userId),
      'members.leftAt': null,
    });

    return activeCommittees.some((c) =>
      c.members.some(
        (m) =>
          m.user.toString() === userId &&
          !m.leftAt &&
          positions.includes(m.position)
      )
    );
  }

  /**
   * Auto-grant the Advisor tag to a user (used on committee archive for ex-president/GS).
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
}

export const committeeService = new CommitteeService();
