import webpush from 'web-push';
import { env } from './env';
import mongoose from 'mongoose';

// PushSubscription model (inline to avoid circular deps)
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1, endpoint: 1 }, { unique: true });

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

/**
 * Initialize VAPID details for web push.
 * Call once at startup (no-op if keys not configured).
 */
export function initWebPush(): void {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      `mailto:${env.SMTP_USER || 'noreply@rdswa.org'}`,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
  }
}

/**
 * Send a web push notification to all subscriptions of a user.
 * Removes stale subscriptions automatically.
 */
export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; link?: string }
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  const subs = await PushSubscription.find({ user: userId });
  if (subs.length === 0) return;

  const data = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth },
        },
        data
      );
    } catch (err: any) {
      // 410 Gone or 404 — subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.deleteOne({ _id: sub._id });
      }
    }
  }
}
