/**
 * One-time backfill for the new isAlumni / isAdvisor / isSeniorAdvisor flags.
 *
 * What this does for every existing user:
 *  1. If their legacy `role` was 'alumni', set `alumniApproved = true` (treat the existing
 *     explicit alumni assignment as sticky — equivalent to a form approval).
 *  2. If their legacy `role` was 'advisor', set `isAdvisor = true`.
 *  3. If their legacy `role` was 'senior_advisor', set `isSeniorAdvisor = true`.
 *  4. For any archived (non-current) committees, any member who held PRESIDENT or
 *     GENERAL_SECRETARY → set `isAdvisor = true` (the new auto-retain rule).
 *  5. Call `.save()` on every touched user so the pre-save hook recomputes `isAlumni`
 *     from (approved member) AND (alumniApproved OR current job/business).
 *
 * Safe to re-run — it's idempotent. Does not delete or downgrade any existing data.
 *
 * Run with:  npm run backfill:role-flags  (from the server package)
 */

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User, Committee, RoleAssignment } from '../models';
import { UserRole, CommitteePosition } from '@rdswa/shared';

const ADVISOR_AUTO_POSITIONS: string[] = [
  CommitteePosition.PRESIDENT,
  CommitteePosition.GENERAL_SECRETARY,
];

interface Counters {
  scanned: number;
  alumniApprovedBackfilled: number;
  advisorBackfilledFromRole: number;
  seniorAdvisorBackfilledFromRole: number;
  advisorFromArchivedCommittee: number;
  saved: number;
  isAlumniNowTrue: number;
  isAdvisorNowTrue: number;
  isSeniorAdvisorNowTrue: number;
}

async function backfill(): Promise<Counters> {
  const counters: Counters = {
    scanned: 0,
    alumniApprovedBackfilled: 0,
    advisorBackfilledFromRole: 0,
    seniorAdvisorBackfilledFromRole: 0,
    advisorFromArchivedCommittee: 0,
    saved: 0,
    isAlumniNowTrue: 0,
    isAdvisorNowTrue: 0,
    isSeniorAdvisorNowTrue: 0,
  };

  // --- Step 1: walk every non-deleted user and apply role→flag backfill ---
  const cursor = User.find({ isDeleted: false }).cursor();

  for await (const user of cursor) {
    counters.scanned++;
    let touched = false;

    // (1) legacy role === 'alumni' → sticky approval
    if (user.role === UserRole.ALUMNI && !user.alumniApproved) {
      user.alumniApproved = true;
      user.alumniAssignment = {
        type: 'manual',
        reason: 'backfill_from_legacy_role',
        assignedAt: new Date(),
      };
      counters.alumniApprovedBackfilled++;
      touched = true;
    }

    // (2) legacy role === 'advisor' → isAdvisor tag
    if (user.role === UserRole.ADVISOR && !user.isAdvisor) {
      user.isAdvisor = true;
      user.advisorAssignment = {
        type: 'manual',
        reason: 'backfill_from_legacy_role',
        assignedAt: new Date(),
      };
      counters.advisorBackfilledFromRole++;
      touched = true;
    }

    // (3) legacy role === 'senior_advisor' → isSeniorAdvisor tag
    if (user.role === UserRole.SENIOR_ADVISOR && !user.isSeniorAdvisor) {
      user.isSeniorAdvisor = true;
      // No assignedBy available in backfill — use a system marker
      user.seniorAdvisorAssignment = {
        reason: 'backfill_from_legacy_role',
        assignedBy: user._id as any, // self-reference as system placeholder
        assignedAt: new Date(),
      };
      counters.seniorAdvisorBackfilledFromRole++;
      touched = true;
    }

    if (touched) {
      await user.save(); // pre-save hook recomputes isAlumni
      counters.saved++;
    } else {
      // Even for untouched users, trigger a save so the pre-save hook
      // recomputes isAlumni from current job/business state. This makes
      // auto-tagged alumni (members with current employment) visible
      // immediately without waiting for the cron.
      const needsRecompute =
        user.membershipStatus === 'approved' &&
        !user.isAlumni &&
        ((user.jobHistory || []).some((j) => j.isCurrent) ||
          (user.businessInfo || []).some((b) => b.isCurrent));
      if (needsRecompute) {
        user.alumniAssignment = {
          type: 'auto',
          reason: 'backfill_auto_detect',
          assignedAt: new Date(),
        };
        await user.save();
        counters.saved++;
      }
    }

    if (user.isAlumni) counters.isAlumniNowTrue++;
    if (user.isAdvisor) counters.isAdvisorNowTrue++;
    if (user.isSeniorAdvisor) counters.isSeniorAdvisorNowTrue++;
  }

  // --- Step 2: sweep archived committees for ex-president / ex-GS → advisor ---
  const archivedCommittees = await Committee.find({
    isDeleted: false,
    isCurrent: false,
  });

  for (const committee of archivedCommittees) {
    for (const member of committee.members) {
      if (member.leftAt) continue;
      if (!ADVISOR_AUTO_POSITIONS.includes(member.position)) continue;

      const user = await User.findById(member.user);
      if (!user || user.isDeleted) continue;
      if (user.isAdvisor) continue; // already set

      user.isAdvisor = true;
      user.advisorAssignment = {
        type: 'auto',
        reason: `backfill_committee_archived_${member.position}`,
        assignedAt: new Date(),
      };
      await user.save();
      counters.saved++;
      counters.advisorFromArchivedCommittee++;
      counters.isAdvisorNowTrue++;

      // Audit log entry
      await RoleAssignment.create({
        user: user._id,
        role: UserRole.ADVISOR,
        previousRole: user.role,
        assignmentType: 'auto',
        reason: `backfill_committee_archived_${member.position}`,
      });
    }
  }

  return counters;
}

async function main() {
  console.log('[backfill] connecting to database...');
  await connectDB();
  console.log('[backfill] starting role-flag backfill...');

  try {
    const counters = await backfill();
    console.log('\n[backfill] complete');
    console.log('─────────────────────────────────────────────');
    console.log(`  scanned users:                     ${counters.scanned}`);
    console.log(`  alumniApproved set from role:      ${counters.alumniApprovedBackfilled}`);
    console.log(`  isAdvisor set from legacy role:    ${counters.advisorBackfilledFromRole}`);
    console.log(`  isAdvisor from archived committee: ${counters.advisorFromArchivedCommittee}`);
    console.log(`  isSeniorAdvisor set from role:     ${counters.seniorAdvisorBackfilledFromRole}`);
    console.log(`  users saved:                       ${counters.saved}`);
    console.log('─────────────────────────────────────────────');
    console.log(`  users with isAlumni=true now:      ${counters.isAlumniNowTrue}`);
    console.log(`  users with isAdvisor=true now:     ${counters.isAdvisorNowTrue}`);
    console.log(`  users with isSeniorAdvisor=true:   ${counters.isSeniorAdvisorNowTrue}`);
    console.log('─────────────────────────────────────────────');
  } catch (err) {
    console.error('[backfill] failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[backfill] disconnected');
  }
}

main();
