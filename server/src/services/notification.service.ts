import { Notification, User } from '../models';
import { getIO } from '../socket';
import { sendEmail } from '../config/mail';
import { sendPushNotification } from '../config/webpush';
import mongoose from 'mongoose';

interface SendNotificationOpts {
  recipientId: string | mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Skip preference/DND checks (e.g., for critical system alerts) */
  force?: boolean;
}

interface SendBulkNotificationOpts {
  recipientIds: (string | mongoose.Types.ObjectId)[];
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  force?: boolean;
}

/**
 * Central notification service that respects user preferences.
 * Handles: in-app DB creation, Socket.IO real-time, email, and web push.
 */
export class NotificationService {
  /**
   * Send a notification to a single user.
   * Checks DND and channel preferences before delivering.
   */
  async send(opts: SendNotificationOpts): Promise<void> {
    const { recipientId, type, title, message, link, metadata, force } = opts;
    const rid = recipientId.toString();

    // Fetch user preferences
    const user = await User.findById(rid).select('notificationPrefs email name').lean();
    if (!user) return;

    const prefs = user.notificationPrefs || {
      email: true, sms: false, push: true, inApp: true,
      digestFrequency: 'daily', dnd: false,
    };

    // DND check (skip if forced)
    if (prefs.dnd && !force) return;

    // 1. In-app notification (always, unless inApp disabled)
    if (prefs.inApp || force) {
      await Notification.create({ recipient: rid, type, title, message, link, metadata });

      // 2. Real-time Socket.IO delivery
      this.emitToUser(rid, { type, title, message, link, metadata });
    }

    // 3. Email notification (if enabled and not digest-only)
    if ((prefs.email && prefs.digestFrequency === 'none') || force) {
      this.sendEmailSafe(user.email, title, message, link);
    }
    // If digest is daily/weekly, the digest job will handle email

    // 4. Web push (if enabled)
    if (prefs.push || force) {
      this.sendPushSafe(rid, title, message, link);
    }
  }

  /**
   * Send notification to multiple users at once.
   * More efficient than calling send() in a loop for broadcast scenarios.
   */
  async sendBulk(opts: SendBulkNotificationOpts): Promise<number> {
    const { recipientIds, type, title, message, link, metadata, force } = opts;

    if (recipientIds.length === 0) return 0;

    // Batch fetch user preferences
    const users = await User.find({
      _id: { $in: recipientIds },
      isDeleted: false,
    }).select('notificationPrefs email name').lean();

    const inAppDocs: any[] = [];
    const emailTargets: Array<{ email: string; name: string }> = [];
    const pushTargets: string[] = [];

    for (const user of users) {
      const prefs = user.notificationPrefs || {
        email: true, sms: false, push: true, inApp: true,
        digestFrequency: 'daily', dnd: false,
      };

      // DND check
      if (prefs.dnd && !force) continue;

      // In-app
      if (prefs.inApp || force) {
        inAppDocs.push({
          recipient: user._id,
          type, title, message, link, metadata,
        });
        this.emitToUser(user._id.toString(), { type, title, message, link, metadata });
      }

      // Email (immediate only if digest is 'none')
      if ((prefs.email && prefs.digestFrequency === 'none') || force) {
        emailTargets.push({ email: user.email, name: user.name });
      }

      // Push
      if (prefs.push || force) {
        pushTargets.push(user._id.toString());
      }
    }

    // Batch insert notifications
    if (inAppDocs.length > 0) {
      await Notification.insertMany(inAppDocs);
    }

    // Send emails (fire-and-forget)
    for (const t of emailTargets) {
      this.sendEmailSafe(t.email, title, message, link);
    }

    // Send push notifications (fire-and-forget)
    for (const uid of pushTargets) {
      this.sendPushSafe(uid, title, message, link);
    }

    return inAppDocs.length;
  }

  /**
   * Emit real-time notification to a specific user via Socket.IO.
   */
  private emitToUser(userId: string, data: any): void {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification', data);
    }
  }

  /**
   * Send email without throwing (fire-and-forget).
   */
  private async sendEmailSafe(to: string, subject: string, body: string, link?: string): Promise<void> {
    try {
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <p style="color: #555; line-height: 1.6;">${body}</p>
          ${link ? `<p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}${link}" style="color: #3b82f6;">View Details</a></p>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">RDSWA — University of Barishal</p>
        </div>
      `;
      await sendEmail(to, subject, html);
    } catch (err) {
      console.error('Notification email failed:', err);
    }
  }

  /**
   * Send web push notification without throwing.
   */
  private async sendPushSafe(userId: string, title: string, body: string, link?: string): Promise<void> {
    try {
      await sendPushNotification(userId, { title, body, link });
    } catch {
      // Push subscription may not exist — ignore
    }
  }
}

export const notificationService = new NotificationService();
