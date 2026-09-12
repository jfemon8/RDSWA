/** How long a soft-deleted record stays recoverable before retention removes it for good. */
export const RETENTION_DAYS = 365;

/** The date a soft-deleted record must predate to be purged. */
export function purgeCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
