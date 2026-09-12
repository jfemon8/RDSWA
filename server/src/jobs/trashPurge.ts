import { TRASH_RESOURCES } from '../config/trashResources';
import { RETENTION_DAYS, purgeCutoff } from '../config/retention';

/** Records soft-deleted before the cutoff, reading `updatedAt` for ones deleted before the stamp existed. */
export function trashPurgeFilter(cutoff: Date, protect?: Record<string, unknown>) {
  return {
    isDeleted: true,
    ...(protect ?? {}),
    $or: [
      { deletedAt: { $lte: cutoff } },
      { deletedAt: { $exists: false }, updatedAt: { $lte: cutoff } },
      { deletedAt: null, updatedAt: { $lte: cutoff } },
    ],
  };
}

/** Empties everything from the bin that was never recovered within the retention window. */
export async function runTrashPurge(): Promise<number> {
  const cutoff = purgeCutoff();
  let total = 0;

  for (const resource of TRASH_RESOURCES) {
    try {
      const result = await resource.model.deleteMany(
        trashPurgeFilter(cutoff, resource.protect as any) as any
      );
      total += result.deletedCount ?? 0;
    } catch (err) {
      // One failing collection must not stop the rest of the sweep.
      console.error(`[trashPurge] ${resource.key} failed:`, err);
    }
  }

  if (total > 0) {
    console.log(
      `[trashPurge] Permanently removed ${total} record(s) deleted before ${cutoff.toISOString().slice(0, 10)} (${RETENTION_DAYS}-day retention)`
    );
  }
  return total;
}

/** Start the sweep on an interval (default: once a day). */
export function startTrashPurge(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  runTrashPurge();
  return setInterval(runTrashPurge, intervalMs);
}
