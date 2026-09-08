/** Announcements are stored as one message body, with the title in front of the content. */
export function parseAnnouncement(raw: string | undefined): { title: string; body: string } {
  const match = raw?.match(/^\*\*(.+?)\*\*\n\n([\s\S]*)$/);
  return { title: match ? match[1] : 'Announcement', body: match ? match[2] : raw || '' };
}
