/** A path segment Cloudinary adds to a delivery URL rather than part of the asset's own id. */
function isDeliverySegment(segment: string): boolean {
  return /^v\d+$/.test(segment) || /^[a-z]{1,3}_[^/]+$/.test(segment);
}

/** Recovers the id the destroy API needs from a delivery URL, which is all a record stores. */
export function cloudinaryPublicId(url?: string | null): string | null {
  if (!url || !url.includes('res.cloudinary.com')) return null;

  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }

  const marker = '/upload/';
  const at = path.indexOf(marker);
  if (at < 0) return null;

  const segments = path
    .slice(at + marker.length)
    .split('/')
    .filter(Boolean);

  // Version and transformation segments sit ahead of the id, so they are skipped from the left.
  let start = 0;
  while (start < segments.length - 1 && isDeliverySegment(segments[start])) start += 1;

  const id = segments.slice(start).join('/');
  if (!id) return null;

  return id.replace(/\.[a-z0-9]{1,8}$/i, '');
}
