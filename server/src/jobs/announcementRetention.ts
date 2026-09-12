import { AnnouncementComment, Message } from '../models';
import { removeAnnouncementNotifications } from '../utils/announcementNotifications';

/** How long an announcement stays before it is erased for good. */
export const ANNOUNCEMENT_LIFETIME_DAYS = 365;

/** The date an announcement must predate to be erased. */
export function announcementCutoff(now = new Date()): Date {
  return new Date(now.getTime() - ANNOUNCEMENT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

/** Erases announcements a year after they were posted, taking their comments and notifications with them. */
export async function runAnnouncementRetention(): Promise<number> {
  try {
    const cutoff = announcementCutoff();
    // Already-deleted ones are included, since nothing links back to them either.
    const expired = await Message.find({
      isAnnouncement: true,
      createdAt: { $lte: cutoff },
    })
      .select('_id content')
      .lean();

    if (expired.length === 0) return 0;

    for (const announcement of expired) {
      await removeAnnouncementNotifications(String(announcement._id), announcement.content);
      await AnnouncementComment.deleteMany({ announcement: announcement._id });
      await Message.deleteOne({ _id: announcement._id });
    }

    console.log(`[announcementRetention] Erased ${expired.length} announcement(s) posted before ${cutoff.toISOString().slice(0, 10)}`);
    return expired.length;
  } catch (err) {
    console.error('[announcementRetention] Job error:', err);
    return 0;
  }
}

/** Start the retention sweep on an interval (default: once a day). */
export function startAnnouncementRetention(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  runAnnouncementRetention();
  return setInterval(runAnnouncementRetention, intervalMs);
}
