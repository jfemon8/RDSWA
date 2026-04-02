import { User, RoleAssignment, Notification } from '../models';
import { UserRole } from '@rdswa/shared';

/**
 * Periodic job to auto-detect alumni based on job/business history.
 * Members with current employment or business are tagged as alumni.
 * Run this on a schedule (e.g., daily via setInterval or cron).
 */
export async function runAlumniTagger(): Promise<void> {
  try {
    // Find approved members who have current job or business but aren't already alumni/moderator/admin/super_admin
    const candidates = await User.find({
      isDeleted: false,
      membershipStatus: 'approved',
      role: { $in: [UserRole.MEMBER] },
      $or: [
        { 'jobHistory.isCurrent': true },
        { 'businessInfo.isCurrent': true },
      ],
    });

    let count = 0;
    for (const user of candidates) {
      try {
        const previousRole = user.role;
        user.role = UserRole.ALUMNI;
        await user.save();

        await RoleAssignment.create({
          user: user._id,
          role: UserRole.ALUMNI,
          previousRole,
          assignmentType: 'auto',
          reason: 'alumni_auto_tagger',
        });

        await Notification.create({
          recipient: user._id,
          type: 'role_changed',
          title: 'Alumni Status Assigned',
          message: 'You have been classified as an Alumni based on your current employment or business.',
          link: '/dashboard',
        });

        count++;
      } catch (err) {
        console.error(`Alumni tagger: failed to tag user ${user._id}:`, err);
      }
    }

    if (count > 0) {
      console.log(`Alumni tagger: tagged ${count} users as alumni`);
    }
  } catch (err) {
    console.error('Alumni tagger error:', err);
  }
}

/**
 * Start the alumni tagger on an interval (default: every 24 hours).
 */
export function startAlumniTagger(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  // Run once immediately
  runAlumniTagger();
  // Then on interval
  return setInterval(runAlumniTagger, intervalMs);
}
