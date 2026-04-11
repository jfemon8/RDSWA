/**
 * Build a URL that routes a Cloudinary file through our backend proxy.
 *
 * Cloudinary serves `raw` resources (PDFs, Word, Excel, etc.) with
 * `Content-Type: application/octet-stream`, which forces browsers to download
 * them as opaque binary blobs instead of previewing inline. The proxy at
 * `/api/upload/proxy` refetches the file and re-serves it with the proper
 * Content-Type and a sensible Content-Disposition so PDFs preview in the
 * browser's built-in viewer and downloads keep their original filename.
 *
 * Use this helper everywhere a Cloudinary attachment URL is rendered as an
 * `<a href>` or `window.open()` target.
 *
 * @param rawUrl  The Cloudinary `secure_url` returned from the upload API
 * @param name    Optional filename hint — surfaces in the download dialog
 * @param inline  `true` (default) → preview in browser; `false` → force download
 */
export function proxyFileUrl(rawUrl: string, name?: string, inline = true): string {
  if (!rawUrl) return '';
  // Non-Cloudinary URLs (e.g. external links) should pass through untouched —
  // the proxy rejects them anyway as an SSRF guard.
  if (!rawUrl.includes('res.cloudinary.com')) return rawUrl;
  const params = new URLSearchParams({ url: rawUrl, inline: String(inline) });
  if (name) params.set('name', name);
  return `/api/upload/proxy?${params.toString()}`;
}
