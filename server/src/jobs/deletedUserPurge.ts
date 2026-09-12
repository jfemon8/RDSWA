import { User } from '../models';
import { UserRole } from '@rdswa/shared';
import { purgeCutoff } from '../config/retention';

/** Accounts soft-deleted before the cutoff, reading `updatedAt` where the stamp is missing, never a SuperAdmin. */
export function purgeFilter(cutoff: Date) {
  return {
    isDeleted: true,
    role: { $ne: UserRole.SUPER_ADMIN },
    $or: [
      { deletedAt: { $lte: cutoff } },
      { deletedAt: { $exists: false }, updatedAt: { $lte: cutoff } },
      { deletedAt: null, updatedAt: { $lte: cutoff } },
    ],
  };
}

/** Removes soft-deleted accounts that were never recovered within the retention window. */
export async function runDeletedUserPurge(): Promise<number> {
  try {
    const cutoff = purgeCutoff();
    const result = await User.deleteMany(purgeFilter(cutoff) as any);

    if (result.deletedCount > 0) {
      console.log(
        `[deletedUserPurge] Permanently removed ${result.deletedCount} account(s) soft-deleted before ${cutoff.toISOString().slice(0, 10)}`
      );
    }
    return result.deletedCount ?? 0;
  } catch (err) {
    console.error('[deletedUserPurge] Job error:', err);
    return 0;
  }
}

/** Start the purge on an interval (default: once a day). */
export function startDeletedUserPurge(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  runDeletedUserPurge();
  return setInterval(runDeletedUserPurge, intervalMs);
}
