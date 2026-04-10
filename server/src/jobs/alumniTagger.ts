import { User, RoleAssignment, Notification } from '../models';
import { UserRole } from '@rdswa/shared';

/**
 * Periodic reconciliation job for the isAlumni flag.
 *
 * Instant tagging happens in UserService.updateProfile on profile save.
 * This job is a safety net that catches any drift — e.g., users whose
 * isAlumni flag is out-of-sync with their current job/business state
 * (edge cases like direct DB writes or pre-save hook failures).
 *
 * It does NOT mutate the user.role field anymore — isAlumni is now
 * a persisted flag computed in the User pre-save hook.
 */
export async function runAlumniTagger(): Promise<void> {
  try {
    // Find approved members who qualify for alumni (current job/business) but isAlumni is false
    const candidates = await User.find({
      isDeleted: false,
      membershipStatus: 'approved',
      isAlumni: false,
      $or: [
        { 'jobHistory.isCurrent': true },
        { 'businessInfo.isCurrent': true },
      ],
    });

    let count = 0;
    for (const user of candidates) {
      try {
        user.alumniAssignment = {
          type: 'auto',
          reason: 'alumni_auto_tagger_reconcile',
          assignedAt: new Date(),
        };
        await user.save(); // pre-save hook flips isAlumni → true

        if (user.isAlumni) {
          await RoleAssignment.create({
            user: user._id,
            role: UserRole.ALUMNI,
            previousRole: user.role,
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
        }
      } catch (err) {
        console.error(`Alumni tagger: failed to tag user ${user._id}:`, err);
      }
    }

    if (count > 0) {
      console.log(`Alumni tagger: reconciled ${count} users as alumni`);
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
