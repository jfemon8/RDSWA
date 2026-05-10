import { env } from '../config/env';

/**
 * `CLIENT_URL` is a comma-separated CORS allowlist (e.g.
 * `"https://rdswa.vercel.app,https://rdswa.info.bd,https://www.rdswa.info.bd"`).
 * For email links we need ONE concrete URL, not the joined string.
 *
 * Returns the first entry (the "primary" deployment URL — typically the
 * Vercel one, useful for the CTA button) and the last entry (the canonical
 * custom-domain URL — used as a plaintext fallback link). When only one
 * URL is configured both helpers return the same value.
 */
function splitClientUrls(): string[] {
  return (env.CLIENT_URL || '')
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, '')) // strip trailing slashes
    .filter(Boolean);
}

export function getAppUrl(): string {
  return splitClientUrls()[0] || 'https://www.rdswa.info.bd';
}

export function getCanonicalAppUrl(): string {
  const list = splitClientUrls();
  return list[list.length - 1] || list[0] || 'https://www.rdswa.info.bd';
}

interface EmailLayoutOptions {
  /** Page-title-style heading shown at the top of the body. */
  heading: string;
  /** Optional preheader — shows in the inbox preview row. */
  preheader?: string;
  /** Greeting line (e.g. "Hello Emon,") — leave undefined to skip. */
  greeting?: string;
  /** Body paragraphs — already escaped/safe HTML or plain strings. */
  intro: string | string[];
  /** Primary CTA button. If omitted, the layout still renders cleanly. */
  cta?: { label: string; url: string };
  /** Plaintext fallback link shown after "or," — recipients can copy/paste. */
  fallbackUrl?: string;
  /** Highlighted code block (used for OTPs etc.). */
  code?: string;
  /** Footer note (e.g. "If you didn't request this, ignore this email."). */
  footerNote?: string;
}

/**
 * Build a self-contained HTML email body with inline styles. Email clients
 * routinely strip `<style>` tags and don't load external CSS, so every
 * style declaration here is inline. Layout uses tables for Outlook safety.
 */
export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const {
    heading,
    preheader,
    greeting,
    intro,
    cta,
    fallbackUrl,
    code,
    footerNote,
  } = opts;

  const intros = Array.isArray(intro) ? intro : [intro];
  const year = new Date().getFullYear();

  const ctaBlock = cta
    ? `
      <tr>
        <td align="center" style="padding:24px 0 8px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td bgcolor="#3b82f6" style="border-radius:8px;">
                <a href="${cta.url}"
                   target="_blank"
                   style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);">
                  ${escapeHtml(cta.label)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const fallbackBlock = fallbackUrl
    ? `
      <tr>
        <td style="padding:14px 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;text-align:center;">or copy &amp; paste this link:</td>
      </tr>
      <tr>
        <td style="padding:0 0 8px 0;font-family:'Courier New',Courier,monospace;font-size:12px;color:#3b82f6;text-align:center;word-break:break-all;line-height:1.5;">
          <a href="${fallbackUrl}" target="_blank" style="color:#3b82f6;text-decoration:underline;">${escapeHtml(fallbackUrl)}</a>
        </td>
      </tr>`
    : '';

  const codeBlock = code
    ? `
      <tr>
        <td align="center" style="padding:20px 0;">
          <div style="display:inline-block;padding:18px 28px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;background:#f3f4f6;border:2px dashed #3b82f6;border-radius:10px;">
            ${escapeHtml(code)}
          </div>
        </td>
      </tr>`
    : '';

  const greetingBlock = greeting
    ? `<tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#111827;">${escapeHtml(greeting)}</td></tr>`
    : '';

  const introBlocks = intros
    .map(
      (p) =>
        `<tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">${p}</td></tr>`
    )
    .join('');

  const footerBlock = footerNote
    ? `<tr><td style="padding:18px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;margin-top:18px;">${escapeHtml(footerNote)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f3f4f6;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Brand bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 50%,#ec4899 100%);padding:20px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:1px;color:#ffffff;">RDSWA</td>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.85);text-align:right;">University of Barishal</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Heading -->
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${escapeHtml(heading)}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${greetingBlock}
                ${introBlocks}
                ${codeBlock}
                ${ctaBlock}
                ${fallbackBlock}
                ${footerBlock}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 28px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;line-height:1.5;text-align:center;">
              © ${year} Rangpur Divisional Student Welfare Association · University of Barishal<br>
              <a href="${getCanonicalAppUrl()}" target="_blank" style="color:#3b82f6;text-decoration:none;">${getCanonicalAppUrl().replace(/^https?:\/\//, '')}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Minimal HTML escape for user-provided strings going into the template. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
