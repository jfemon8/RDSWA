import { Committee, User, RoleAssignment } from '../models';
import {
  UserRole,
  SUPER_ADMIN_EMAILS,
  ADMIN_AUTO_POSITIONS,
  MODERATOR_AUTO_POSITIONS,
} from '@rdswa/shared';
import { resolveBaseRole } from '../utils/resolveBaseRole';

/**
 * One-time role sync on server start.
 *
 * 1. Ensures all SUPER_ADMIN_EMAILS have role=super_admin
 * 2. Re-evaluates current committee members:
 *    - President/GS → Admin (was Moderator under old logic)
 *    - OS/Treasurer → Moderator (unchanged, but ensures consistency)
 */
export async function syncRolesOnStart(): Promise<void> {
  try {
    // ── 1. Sync SuperAdmin emails ──
    for (const email of SUPER_ADMIN_EMAILS) {
      const user = await User.findOne({ email, isDeleted: false });
      if (!user) continue;
      let changed = false;
      if (user.role !== UserRole.SUPER_ADMIN) {
        user.role = UserRole.SUPER_ADMIN;
        changed = true;
      }
      if (user.membershipStatus !== 'approved') {
        user.membershipStatus = 'approved' as any;
        changed = true;
      }
      if (!user.isModerator) {
        user.isModerator = true;
        changed = true;
      }
      if (changed) {
        await user.save();
        console.log(`[RoleSync] Fixed SuperAdmin: ${email}`);
      }
    }

    // ── 2. Sync current committee auto-roles ──
    const currentCommittees = await Committee.find({ isCurrent: true, isDeleted: false });

    for (const committee of currentCommittees) {
      for (const member of committee.members) {
        if (member.leftAt) continue;

        const user = await User.findById(member.user);
        if (!user || user.isDeleted) continue;

        // Don't touch SuperAdmins
        if (SUPER_ADMIN_EMAILS.includes(user.email)) continue;

        // President/GS → should be Admin
        if (ADMIN_AUTO_POSITIONS.includes(member.position)) {
          if (user.role !== UserRole.ADMIN) {
            const previousRole = user.role;
            user.role = UserRole.ADMIN;
            user.isModerator = true;
            user.moderatorAssignment = {
              type: 'auto',
              reason: member.position,
              assignedAt: new Date(),
            };
            await user.save();

            await RoleAssignment.create({
              user: user._id,
              role: UserRole.ADMIN,
              previousRole,
              assignmentType: 'auto',
              reason: `role_sync_${member.position}`,
            });

            console.log(`[RoleSync] ${user.name} (${user.email}): ${previousRole} → admin (${member.position})`);
          }
        }

        // OS/Treasurer → should be Moderator (if not already Admin+)
        if (MODERATOR_AUTO_POSITIONS.includes(member.position)) {
          if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.MODERATOR) {
            const previousRole = user.role;
            user.role = UserRole.MODERATOR;
            user.isModerator = true;
            user.moderatorAssignment = {
              type: 'auto',
              reason: member.position,
              assignedAt: new Date(),
            };
            await user.save();

            await RoleAssignment.create({
              user: user._id,
              role: UserRole.MODERATOR,
              previousRole,
              assignmentType: 'auto',
              reason: `role_sync_${member.position}`,
            });

            console.log(`[RoleSync] ${user.name} (${user.email}): ${previousRole} → moderator (${member.position})`);
          }
        }
      }
    }

    console.log('[RoleSync] Role sync completed');
  } catch (err) {
    console.error('[RoleSync] Error during role sync:', err);
  }
}
