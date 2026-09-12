/**
 * Route a Cloudinary file through the backend proxy, which re-serves it with a real Content-Type so PDFs preview instead of downloading as opaque blobs.
 *
 * @param rawUrl  The Cloudinary `secure_url` returned from the upload API
 * @param name    Optional filename hint surfaced in the download dialog
 * @param inline  `true` previews in the browser, `false` forces a download
 */
export function proxyFileUrl(rawUrl: string, name?: string, inline = true): string {
  if (!rawUrl) return '';
  // Non-Cloudinary URLs (e.g. external links) should pass through untouched -
  // the proxy rejects them anyway as an SSRF guard.
  if (!rawUrl.includes('res.cloudinary.com')) return rawUrl;
  const params = new URLSearchParams({ url: rawUrl, inline: String(inline) });
  if (name) params.set('name', name);
  return `/api/upload/proxy?${params.toString()}`;
}
