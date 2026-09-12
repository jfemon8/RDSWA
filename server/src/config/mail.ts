import nodemailer from 'nodemailer';
import { env } from './env';

/** Two-mode mail transport behind one interface, using Resend's HTTPS API when `RESEND_API_KEY` is set and Nodemailer SMTP otherwise. */

const useResend = !!env.RESEND_API_KEY;

// Print the chosen transport at module load, so a missing env var is obvious on PaaS.
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
      // Explicit timeouts, without which Nodemailer hangs for about ten minutes on a silently dropped connection.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });

/** Verify the mail transport at boot and log once, leaving the server usable if it fails. */
export async function verifyMailTransport(): Promise<void> {
  if (useResend) {
    // Resend has no verify endpoint, so an empty POST to /emails checks credentials without sending: 401 means a bad key and 422 means success.
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
          `[Mail] Resend verification FAILED: 401 Unauthorized, ${body.slice(0, 200)}`
        );
        console.error('[Mail] The RESEND_API_KEY is wrong, revoked, or restricted in a way that blocks even sending.');
      } else if (res.status >= 500) {
        console.error(`[Mail] Resend verification: upstream returned ${res.status} (transient)`);
      } else {
        // 200 / 422 / 4xx-other, auth is fine, transport is reachable.
        console.log('[Mail] Resend HTTP API verified, ready to send.');
      }
    } catch (err: any) {
      console.error('[Mail] Resend verification FAILED (network):', err?.message || err);
    }
    return;
  }

  if (smtpTransporter) {
    try {
      await smtpTransporter.verify();
      console.log('[Mail] SMTP transporter verified, ready to send.');
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

  console.warn('[Mail] No mail transport configured. Set RESEND_API_KEY or SMTP credentials.');
}

/** Send a transactional email, throwing on failure so callers decide whether to surface or swallow it. */
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

// Kept for code that imported the SMTP transporter directly, returning null on the Resend path.
export const transporter = smtpTransporter;
