import { Message } from '../models';
import { cloudinary } from '../config/cloudinary';
import { CHAT_MEDIA_RETENTION_DAYS, chatMediaExpiry } from '../config/retention';

/** Removes a file from Cloudinary, reporting whether the storage side is now clear. */
async function destroyAsset(publicId: string, resourceType?: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image',
      invalidate: true,
    });
    return true;
  } catch (err) {
    console.error(`[chatMediaPurge] Cloudinary destroy failed for ${publicId}:`, err);
    return false;
  }
}

/** Drops shared files once retention elapses, from Cloudinary and the message alike, taking a message left with nothing. */
export async function runChatMediaPurge(): Promise<void> {
  try {
    const now = new Date();

    // Entries already marked expired by the older policy are collected too, since they only held a name.
    const candidates = await Message.find({
      attachments: {
        $elemMatch: {
          $or: [{ expiresAt: { $lte: now } }, { expired: true }],
        },
      },
    }).select('_id content attachments');

    if (candidates.length === 0) return;

    let purgedCount = 0;
    let failedCount = 0;
    let emptiedCount = 0;

    for (const message of candidates) {
      const keep: any[] = [];

      for (const att of message.attachments as any[]) {
        const elapsed = att.expiresAt && att.expiresAt.getTime() <= now.getTime();
        if (!elapsed && !att.expired) {
          keep.push(att);
          continue;
        }

        if (att.publicId && !(await destroyAsset(att.publicId, att.resourceType))) {
          failedCount++;
        }
        purgedCount++;
      }

      if (keep.length === message.attachments.length) continue;

      // A message whose only content was the file has nothing left to show.
      if (keep.length === 0 && !message.content?.trim()) {
        await Message.deleteOne({ _id: message._id });
        emptiedCount++;
        continue;
      }

      message.attachments = keep as any;
      await message.save();
    }

    if (purgedCount > 0) {
      console.log(
        `[chatMediaPurge] Removed ${purgedCount} attachment(s) and ${emptiedCount} empty message(s)` +
          (failedCount > 0 ? ` (${failedCount} Cloudinary deletes failed)` : '')
      );
    }
  } catch (err) {
    console.error('[chatMediaPurge] Job error:', err);
  }
}

/** Re-dates files stamped under the previous, shorter policy, so the current one actually applies to them. */
export async function restampChatMediaRetention(): Promise<number> {
  try {
    // Anything older than the longest window is already due, so re-dating it would only delay the purge.
    const longest = Math.max(...Object.values(CHAT_MEDIA_RETENTION_DAYS));
    const messages = await Message.find({
      createdAt: { $gte: new Date(Date.now() - longest * 24 * 60 * 60 * 1000) },
      'attachments.expired': false,
      'attachments.publicId': { $exists: true, $ne: null },
    }).select('_id createdAt attachments');

    let restamped = 0;

    for (const message of messages) {
      let mutated = false;
      for (const att of message.attachments as any[]) {
        if (att.expired || !att.publicId || !CHAT_MEDIA_RETENTION_DAYS[att.kind]) continue;
        const due = chatMediaExpiry(att.kind, (message as any).createdAt || new Date());
        if (att.expiresAt?.getTime() === due.getTime()) continue;
        att.expiresAt = due;
        mutated = true;
      }
      if (mutated) {
        await message.save();
        restamped++;
      }
    }

    if (restamped > 0) {
      console.log(`[chatMediaPurge] Re-dated attachments on ${restamped} message(s) to the current policy`);
    }
    return restamped;
  } catch (err) {
    console.error('[chatMediaPurge] Re-dating failed:', err);
    return 0;
  }
}

/** Start the purge job on an interval (default: every hour). */
export function startChatMediaPurge(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  restampChatMediaRetention().then(runChatMediaPurge);
  return setInterval(runChatMediaPurge, intervalMs);
}
