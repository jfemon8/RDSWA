/**
 * Normalizes notification `link` values before navigation.
 *
 * Historically some server code stored links with the API-path prefix
 * (e.g. `/communication/groups/:id`) instead of the React Router client
 * path (`/dashboard/groups/:id`). Those stored notifications survive in
 * the database until their 90-day TTL expires, so users would hit 404
 * screens when clicking notifications created before the server fix.
 *
 * This helper rewrites known stale prefixes at click time. Adding another
 * mapping is a one-line change if the same class of issue recurs.
 */

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
