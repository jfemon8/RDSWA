import { Notification, User } from '../models';
import { sendEmail } from '../config/mail';
import { renderEmailLayout, escapeHtml, getAppUrl } from '../utils/emailTemplate';

/** One notification rendered as a clean, left-accented card row. */
function notificationCard(title: string, message: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
      <tr>
        <td style="background:#f8fafc;border-left:4px solid #008f57;border-radius:8px;padding:14px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#0f172a;margin-bottom:4px;">${escapeHtml(title)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;line-height:1.55;">${escapeHtml(message)}</div>
        </td>
      </tr>
    </table>`;
}

/**
 * Send digest emails to users who prefer daily/weekly digests.
 * Run every hour; checks if it's time for each user's digest.
 *
 * Uses the shared renderEmailLayout so the digest matches every other
 * transactional email (emerald header + dynamic association footer).
 */
export async function runEmailDigest(): Promise<void> {
  try {
    const now = new Date();
    const hour = now.getUTCHours();

    // Send daily digests at 8 AM UTC, weekly on Mondays
    const isDailyTime = hour === 8;
    const isWeeklyTime = hour === 8 && now.getUTCDay() === 1;

    if (!isDailyTime && !isWeeklyTime) return;

    const frequencies: string[] = [];
    if (isDailyTime) frequencies.push('daily');
    if (isWeeklyTime) frequencies.push('weekly');

    const users = await User.find({
      isDeleted: false,
      isActive: true,
      'notificationPrefs.email': true,
      'notificationPrefs.digestFrequency': { $in: frequencies },
    })
      .select('email name notificationPrefs')
      .lean();

    if (users.length === 0) return;

    const dashboardUrl = `${getAppUrl()}/dashboard/notifications`;

    for (const user of users) {
      const freq = user.notificationPrefs?.digestFrequency || 'daily';
      const since = new Date(
        now.getTime() - (freq === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
      );

      const notifications = await Notification.find({
        recipient: user._id,
        createdAt: { $gte: since },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      if (notifications.length === 0) continue;

      const periodLabel = freq === 'weekly' ? 'Weekly' : 'Daily';
      const count = notifications.length;
      const cards = notifications.map((n) => notificationCard(n.title, n.message)).join('');

      const html = await renderEmailLayout({
        heading: `Your ${periodLabel} Digest`,
        preheader: `${count} new update${count === 1 ? '' : 's'} you may have missed`,
        greeting: `Hi ${user.name},`,
        intro: `Here's a quick recap of what happened ${
          freq === 'weekly' ? 'this week' : 'in the last 24 hours'
        } — ${count} new update${count === 1 ? '' : 's'}.`,
        bodyHtml: cards,
        cta: { label: 'View all notifications', url: dashboardUrl },
        footerNote:
          "You're receiving this because daily/weekly digest emails are enabled in your notification settings.",
      });

      try {
        await sendEmail(
          user.email,
          `Your ${periodLabel} RDSWA Digest (${count} update${count === 1 ? '' : 's'})`,
          html
        );
      } catch (err) {
        console.error(`Digest email failed for ${user.email}:`, err);
      }
    }
  } catch (err) {
    console.error('Email digest job error:', err);
  }
}

export function startEmailDigest(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(runEmailDigest, intervalMs);
}
