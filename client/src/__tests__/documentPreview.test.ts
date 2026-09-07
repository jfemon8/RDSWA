import { describe, it, expect } from 'vitest';
import { proxyFileUrl } from '@/lib/fileProxy';

const CLOUDINARY = 'https://res.cloudinary.com/demo/raw/upload/v1/report.pdf';

describe('document preview URL handling', () => {
  it('proxies a Cloudinary asset so it is served with a real Content-Type', () => {
    expect(proxyFileUrl(CLOUDINARY, 'report.pdf')).toContain('/api/upload/proxy?url=');
  });

  it('double-proxying produces a URL the server would reject, so PdfViewer must get the raw one', () => {
    // proxyFileUrl matches on the substring, and the encoded host survives encoding.
    const once = proxyFileUrl(CLOUDINARY, 'report.pdf');
    const twice = proxyFileUrl(once, 'report.pdf');
    expect(twice).not.toBe(once);
    expect(twice.startsWith('/api/upload/proxy?url=%2Fapi')).toBe(true);
  });

  it('leaves a non-Cloudinary URL untouched', () => {
    expect(proxyFileUrl('https://example.com/a.pdf', 'a.pdf')).toBe('https://example.com/a.pdf');
  });

  it('returns an empty string for a missing URL', () => {
    expect(proxyFileUrl('')).toBe('');
  });
});
