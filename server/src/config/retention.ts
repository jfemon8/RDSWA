/** How long a soft-deleted record stays recoverable before retention removes it for good. */
export const RETENTION_DAYS = 365;

/** The date a soft-deleted record must predate to be purged. */
export function purgeCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** How long a shared file stays in a conversation, with video kept shortest because it costs the most to store. */
export const CHAT_MEDIA_RETENTION_DAYS: Record<string, number> = {
  video: 30,
  image: 365,
  audio: 365,
  pdf: 365,
  file: 365,
};

/** When a file shared now would fall out of the conversation. */
export function chatMediaExpiry(kind: string, from = new Date()): Date {
  const days = CHAT_MEDIA_RETENTION_DAYS[kind] ?? 365;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
