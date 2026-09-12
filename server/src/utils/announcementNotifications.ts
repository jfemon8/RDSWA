import { Notification } from '../models';

/** Splits the `**title**` header the announcement channel writes from the body behind it. */
export function splitAnnouncement(content: string): { title: string | null; body: string } {
  const match = /^\*\*(.+?)\*\*\n\n([\s\S]*)$/.exec(content || '');
  return match
    ? { title: match[1]!.trim(), body: match[2]! }
    : { title: null, body: content || '' };
}

/** Notification text for an announcement, with the rich-text markup taken back out. */
export function announcementPreview(body: string): string {
  return body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
}

/** Matches every notification raised for one announcement, including those sent before they carried its id. */
export function announcementNotificationFilter(announcementId: string, content: string) {
  const { title, body } = splitAnnouncement(content);
  const clauses: Record<string, unknown>[] = [
    { 'metadata.announcementId': announcementId },
    { link: { $regex: `/dashboard/announcements/${announcementId}$` } },
  ];
  // Older ones name no announcement, and a broadcast shares their type, so both texts have to match.
  if (title) {
    clauses.push({
      title,
      message: announcementPreview(body),
      'metadata.announcementId': { $exists: false },
    });
  }
  return { type: 'announcement', $or: clauses };
}

/** Drops an announcement's notifications so a deleted announcement stops showing in the bell. */
export async function removeAnnouncementNotifications(
  announcementId: string,
  content: string
): Promise<number> {
  const result = await Notification.deleteMany(
    announcementNotificationFilter(announcementId, content)
  );
  return result.deletedCount ?? 0;
}
