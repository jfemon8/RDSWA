import nodemailer from 'nodemailer';
import { env } from './env';

/**
 * SMTP transporter with explicit timeouts.
 *
 * Without these, Nodemailer's defaults can leave a request hanging for
 * up to 10 minutes when Gmail's SMTP is slow or silently refusing the
 * connection (e.g. when an App Password has been revoked, or the host
 * IP is flagged for unusual activity). With these in place, a hung
 * connection fails fast and gets logged so the operator can react.
 */
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  // 10s to establish TCP, 10s for the server greeting, 20s of idle
  // socket time. These are conservative for transactional email — Gmail
  // typically responds in under a second when healthy.
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  auth:
    env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
});

/**
 * Verify SMTP credentials and connectivity at startup. Logs once.
 * Doesn't crash the server on failure — the API stays usable and only
 * email-dependent flows surface the issue. Call this from app start.
 */
export async function verifyMailTransport(): Promise<void> {
  try {
    await transporter.verify();
    console.log('[Mail] SMTP transporter verified — ready to send.');
  } catch (err: any) {
    console.error('[Mail] SMTP verification FAILED:', err?.message || err);
    console.error(
      '[Mail] Email-dependent flows (forgot-password, OTP, notifications) will fail until this is fixed.\n' +
      '       Common causes: revoked Gmail App Password, blocked port 587/465 outbound, or wrong SMTP_USER/SMTP_PASS.'
    );
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
