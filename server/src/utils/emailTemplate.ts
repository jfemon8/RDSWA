import { env } from '../config/env';
import { SiteSettings } from '../models';

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

/** Minimal HTML escape for user-provided strings going into the template. */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Branding {
  orgName: string;
  address?: string;
  email?: string;
  phone?: string;
  website: string;
}

// SiteSettings rarely changes; cache the branding for a few minutes so a
// digest run mailing hundreds of users doesn't hammer the DB once per email.
let brandingCache: { data: Branding; at: number } | null = null;
const BRANDING_TTL = 5 * 60 * 1000;

/**
 * Pull the association's identity from SiteSettings for the email footer.
 * Falls back to sensible defaults so an email still renders fully even if
 * the settings document is missing or the DB read fails.
 */
async function getBranding(): Promise<Branding> {
  if (brandingCache && Date.now() - brandingCache.at < BRANDING_TTL) {
    return brandingCache.data;
  }
  let data: Branding = {
    orgName: 'Rangpur Divisional Student Welfare Association',
    website: getCanonicalAppUrl(),
  };
  try {
    const s = await SiteSettings.findOne()
      .select('siteName siteNameFull contactEmail contactPhone address')
      .lean();
    if (s) {
      data = {
        orgName: s.siteNameFull || s.siteName || data.orgName,
        address: s.address || undefined,
        email: s.contactEmail || undefined,
        phone: s.contactPhone || undefined,
        website: getCanonicalAppUrl(),
      };
    }
  } catch {
    /* keep defaults */
  }
  brandingCache = { data, at: Date.now() };
  return data;
}

interface EmailLayoutOptions {
  /** Page-title-style heading shown at the top of the body. */
  heading: string;
  /** Optional preheader — shows in the inbox preview row. */
  preheader?: string;
  /** Greeting line (e.g. "Hello Emon,") — leave undefined to skip. */
  greeting?: string;
  /** Body paragraphs — already escaped/safe HTML or plain strings. */
  intro?: string | string[];
  /** Primary CTA button. If omitted, the layout still renders cleanly. */
  cta?: { label: string; url: string };
  /** Plaintext fallback link shown after "or," — recipients can copy/paste. */
  fallbackUrl?: string;
  /** Highlighted code block (used for OTPs etc.). */
  code?: string;
  /**
   * Raw HTML injected into the body, after `intro`/`code` and before the CTA.
   * For rich content the structured options can't express: digest cards,
   * donation receipts, contact-detail tables. The CALLER is responsible for
   * escaping anything user-supplied inside this string.
   */
  bodyHtml?: string;
  /** Footer note (e.g. "If you didn't request this, ignore this email."). */
  footerNote?: string;
}

/**
 * Build a self-contained HTML email with inline styles. Email clients
 * routinely strip `<style>` tags and don't load external CSS, so every
 * style declaration here is inline; layout uses tables for Outlook safety.
 *
 * Async because the footer (association name / address / contact / website)
 * is pulled live from SiteSettings — every transactional email, digest,
 * contact reply, bulk message and receipt funnels through this one layout
 * so branding stays consistent and updates centrally.
 */
export async function renderEmailLayout(opts: EmailLayoutOptions): Promise<string> {
  const {
    heading,
    preheader,
    greeting,
    intro,
    cta,
    fallbackUrl,
    code,
    bodyHtml,
    footerNote,
  } = opts;

  const intros = intro ? (Array.isArray(intro) ? intro : [intro]) : [];
  const year = new Date().getFullYear();
  const brand = await getBranding();

  const ctaBlock = cta
    ? `
      <tr>
        <td align="center" style="padding:24px 0 8px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td bgcolor="#008f57" style="border-radius:10px;">
                <a href="${cta.url}"
                   target="_blank"
                   style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:linear-gradient(135deg,#008f57 0%,#28b578 100%);">
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
        <td style="padding:0 0 8px 0;font-family:'Courier New',Courier,monospace;font-size:12px;color:#008f57;text-align:center;word-break:break-all;line-height:1.5;">
          <a href="${fallbackUrl}" target="_blank" style="color:#008f57;text-decoration:underline;">${escapeHtml(fallbackUrl)}</a>
        </td>
      </tr>`
    : '';

  const codeBlock = code
    ? `
      <tr>
        <td align="center" style="padding:20px 0;">
          <div style="display:inline-block;padding:18px 28px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;background:#f1f5f9;border:2px dashed #008f57;border-radius:10px;">
            ${escapeHtml(code)}
          </div>
        </td>
      </tr>`
    : '';

  const greetingBlock = greeting
    ? `<tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(greeting)}</td></tr>`
    : '';

  const introBlocks = intros
    .map(
      (p) =>
        `<tr><td style="padding:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">${p}</td></tr>`
    )
    .join('');

  const bodyHtmlBlock = bodyHtml
    ? `<tr><td style="padding:4px 0 0 0;">${bodyHtml}</td></tr>`
    : '';

  const footerNoteBlock = footerNote
    ? `<tr><td style="padding:18px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;">${escapeHtml(footerNote)}</td></tr>`
    : '';

  // ── Dynamic association footer (name / address / contact / website) ──
  const websiteHost = brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const footerRows: string[] = [];
  if (brand.address) {
    footerRows.push(
      `<tr><td style="padding:2px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9aa5b1;">📍 ${escapeHtml(brand.address)}</td></tr>`
    );
  }
  const contactBits: string[] = [];
  if (brand.email) {
    contactBits.push(
      `<a href="mailto:${escapeHtml(brand.email)}" style="color:#28b578;text-decoration:none;">${escapeHtml(brand.email)}</a>`
    );
  }
  if (brand.phone) contactBits.push(escapeHtml(brand.phone));
  if (contactBits.length) {
    footerRows.push(
      `<tr><td style="padding:2px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9aa5b1;">✉️ ${contactBits.join(' &nbsp;·&nbsp; ')}</td></tr>`
    );
  }
  footerRows.push(
    `<tr><td style="padding:2px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9aa5b1;">🌐 <a href="${escapeHtml(brand.website)}" style="color:#28b578;text-decoration:none;">${escapeHtml(websiteHost)}</a></td></tr>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#eef2f6;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
          <!-- Brand header -->
          <tr>
            <td style="background:linear-gradient(135deg,#008f57 0%,#00a060 55%,#28b578 100%);background-color:#008f57;padding:34px 32px 30px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.8);margin-bottom:6px;">${escapeHtml(brand.orgName)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3;">${escapeHtml(heading)}</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${greetingBlock}
                ${introBlocks}
                ${codeBlock}
                ${bodyHtmlBlock}
                ${ctaBlock}
                ${fallbackBlock}
                ${footerNoteBlock}
              </table>
            </td>
          </tr>
          <!-- Dynamic association footer -->
          <tr>
            <td style="background:#0f172a;padding:26px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;">${escapeHtml(brand.orgName)}</td>
                </tr>
                ${footerRows.join('')}
                <tr>
                  <td style="padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#64748b;">
                    © ${year} ${escapeHtml(brand.orgName)} · University of Barishal
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
