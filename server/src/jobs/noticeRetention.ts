import { Notice } from '../models';

/** A notice is archived a year after it was added and erased two years after that. */
export const NOTICE_ARCHIVE_DAYS = 365;
export const NOTICE_DELETE_DAYS = 3 * 365;

/** The date a notice must predate to reach the given stage. */
export function noticeCutoff(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Archives notices at a year old and erases them at three, both counted from when they were added. */
export async function runNoticeRetention(): Promise<{ archived: number; deleted: number }> {
  try {
    const now = new Date();

    // Erasing first keeps a three-year-old notice from being archived and removed in the same pass.
    const deleted = await Notice.deleteMany({
      createdAt: { $lte: noticeCutoff(NOTICE_DELETE_DAYS, now) },
    });

    const archived = await Notice.updateMany(
      {
        isDeleted: false,
        status: { $ne: 'archived' },
        createdAt: { $lte: noticeCutoff(NOTICE_ARCHIVE_DAYS, now) },
      },
      { $set: { status: 'archived', archivedAt: now } }
    );

    if (deleted.deletedCount > 0 || archived.modifiedCount > 0) {
      console.log(
        `[noticeRetention] Archived ${archived.modifiedCount} notice(s), erased ${deleted.deletedCount}`
      );
    }

    return { archived: archived.modifiedCount ?? 0, deleted: deleted.deletedCount ?? 0 };
  } catch (err) {
    console.error('[noticeRetention] Job error:', err);
    return { archived: 0, deleted: 0 };
  }
}

/** Start the retention sweep on an interval (default: once a day). */
export function startNoticeRetention(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  runNoticeRetention();
  return setInterval(runNoticeRetention, intervalMs);
}
