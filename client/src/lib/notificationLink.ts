/** Rewrites stale API-path prefixes in notification links at click time, so records stored before the server fix don't 404. */

const REWRITES: ReadonlyArray<readonly [string, string]> = [
  ['/communication/groups/', '/dashboard/groups/'],
  ['/communication/messages', '/dashboard/messages'],
  ['/communication/forum/', '/dashboard/forum/'],
];

export function normalizeNotificationLink(link: string | undefined | null): string | undefined {
  if (!link) return undefined;
  for (const [from, to] of REWRITES) {
    if (link.startsWith(from)) return to + link.slice(from.length);
  }
  return link;
}
