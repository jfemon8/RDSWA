import { ChatGroup, Message } from '../models';

/**
 * One-time reconciliation on server start, for announcements posted before they carried a flag of
 * their own — they are recognised by the `**title**` header the announcement channel writes.
 */
export async function backfillAnnouncementFlags(): Promise<void> {
  try {
    const centralGroup = await ChatGroup.findOne({ type: 'central', isDeleted: false }).select('_id').lean();
    if (!centralGroup) return;

    const result = await Message.updateMany(
      {
        group: centralGroup._id,
        isAnnouncement: { $ne: true },
        content: { $regex: '^\\*\\*.+\\*\\*\\n\\n' },
      },
      { $set: { isAnnouncement: true } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[AnnouncementBackfill] Flagged ${result.modifiedCount} existing announcement(s)`);
    }
  } catch (err) {
    console.error('[AnnouncementBackfill] Failed:', err);
  }
}
