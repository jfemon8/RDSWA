import { User } from '../models';

/**
 * Mentor listing began as an opt-in that defaulted to off, which left the directory empty because
 * eligibility comes from the Alumni/Advisor tags rather than a choice anyone ever made.
 */
export async function backfillMentorListing(): Promise<void> {
  try {
    const result = await User.updateMany(
      {
        isDeleted: false,
        isMentor: { $ne: true },
        $or: [{ isAlumni: true }, { isAdvisor: true }, { isSeniorAdvisor: true }],
      },
      { $set: { isMentor: true } },
    );
    if (result.modifiedCount > 0) {
      console.log(`[MentorListing] Listed ${result.modifiedCount} eligible member(s) on the mentor directory`);
    }
  } catch (err) {
    console.error('[MentorListing] Failed to backfill mentor listings:', err);
  }
}
