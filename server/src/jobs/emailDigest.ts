import { Notification, User } from '../models';
import { sendEmail } from '../config/mail';

/**
 * Send digest emails to users who prefer daily/weekly digests.
 * Run every hour; checks if it's time for each user's digest.
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
    }).select('email name notificationPrefs').lean();

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

      const itemsHtml = notifications
        .map(
          (n) =>
            `<li style="margin-bottom:8px;">
              <strong>${n.title}</strong>
              <br/><span style="color:#555;">${n.message}</span>
            </li>`
        )
        .join('');

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your ${freq === 'weekly' ? 'Weekly' : 'Daily'} RDSWA Digest</h2>
          <p style="color: #555;">Hi ${user.name}, here's what you missed:</p>
          <ul style="list-style: none; padding: 0;">${itemsHtml}</ul>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">RDSWA — University of Barishal</p>
        </div>
      `;

      try {
        await sendEmail(
          user.email,
          `Your ${freq === 'weekly' ? 'Weekly' : 'Daily'} RDSWA Digest (${notifications.length} notifications)`,
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
