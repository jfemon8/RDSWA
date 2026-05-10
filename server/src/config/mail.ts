import nodemailer from 'nodemailer';
import { env } from './env';

/**
 * Two-mode mail transport.
 *
 *   1. **Resend HTTP API** — used when `RESEND_API_KEY` is set. Sends over
 *      HTTPS (port 443), so it works on PaaS providers like Render's free
 *      tier that block outbound SMTP ports (25 / 465 / 587). This is the
 *      production path.
 *
 *   2. **SMTP via Nodemailer** — used as a fallback when no Resend key is
 *      present. Convenient for local development with Gmail App Password.
 *
 * Both modes expose the same `sendEmail(to, subject, html)` interface and
 * the same `verifyMailTransport()` startup check, so callers (auth.service,
 * routes, jobs) don't need to know which transport is active.
 */

const useResend = !!env.RESEND_API_KEY;

// Boot-time visibility — prints which transport will be used the moment
// the module loads. Saves a round of "is the env var actually set?"
// guessing on PaaS providers.
console.log(
  `[Mail] Active transport: ${useResend ? 'Resend HTTP API' : 'SMTP'} ` +
  `(RESEND_API_KEY ${useResend ? 'detected' : 'NOT detected'}, ` +
  `SMTP_HOST=${env.SMTP_HOST || '<unset>'})`
);

const smtpTransporter = useResend
  ? null
  : nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      // 10s to establish TCP, 10s for the server greeting, 20s socket idle.
      // Without these, Nodemailer can hang for ~10 minutes on a silently
      // dropped connection.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });

/**
 * Verify mail transport at boot. Logs once. Doesn't crash the server on
 * failure — the API stays usable and only email-dependent flows surface
 * the issue with their own per-call logging.
 */
export async function verifyMailTransport(): Promise<void> {
  if (useResend) {
    // Resend has no dedicated `verify` endpoint. We POST to /emails with
    // an intentionally empty body — auth runs *before* validation, so:
    //   - 401  → bad / revoked / mistyped API key
    //   - 422  → auth OK, request validation failed (the success signal here)
    //   - 5xx / network error → upstream issue, log it
    // A send-only "Sending access" key cannot hit /domains or /api-keys, so
    // POST /emails is the only endpoint that round-trips both the network
    // and the credentials without actually delivering mail.
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      if (res.status === 401) {
        const body = await res.text().catch(() => '');
        console.error(
          `[Mail] Resend verification FAILED: 401 Unauthorized — ${body.slice(0, 200)}`
        );
        console.error('[Mail] The RESEND_API_KEY is wrong, revoked, or restricted in a way that blocks even sending.');
      } else if (res.status >= 500) {
        console.error(`[Mail] Resend verification: upstream returned ${res.status} (transient)`);
      } else {
        // 200 / 422 / 4xx-other — auth is fine, transport is reachable.
        console.log('[Mail] Resend HTTP API verified — ready to send.');
      }
    } catch (err: any) {
      console.error('[Mail] Resend verification FAILED (network):', err?.message || err);
    }
    return;
  }

  if (smtpTransporter) {
    try {
      await smtpTransporter.verify();
      console.log('[Mail] SMTP transporter verified — ready to send.');
    } catch (err: any) {
      console.error('[Mail] SMTP verification FAILED:', err?.message || err);
      console.error(
        '[Mail] Email-dependent flows (forgot-password, OTP, notifications) will fail until this is fixed.\n' +
        '       Common causes: revoked Gmail App Password, blocked port 587/465 outbound, or wrong SMTP_USER/SMTP_PASS.\n' +
        '       For PaaS providers that block SMTP egress (Render free tier, etc.), set RESEND_API_KEY to use the HTTP API instead.'
      );
    }
    return;
  }

  console.warn('[Mail] No mail transport configured — set RESEND_API_KEY or SMTP credentials.');
}

/**
 * Send a transactional email. Throws on failure so callers can decide
 * whether to surface the error to the user or log-and-swallow.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (useResend) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend send failed: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    return;
  }

  if (!smtpTransporter) {
    throw new Error('No mail transport configured');
  }
  await smtpTransporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

// Kept for backward compatibility with any code that imported the SMTP
// transporter directly. Returns null when running on the Resend HTTP path.
export const transporter = smtpTransporter;
