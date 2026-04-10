import { Message } from '../models';
import { cloudinary } from '../config/cloudinary';

/**
 * Scan messages for attachments whose retention window has expired, delete the
 * file from Cloudinary, and mark the attachment as expired so the chat UI can
 * render a "File expired" placeholder instead of a broken link.
 *
 * Retention is set when the message is created (see buildAttachments in
 * communication.routes.ts): videos = 30 days, all other media = 90 days.
 * Contact attachments have no expiresAt and are skipped.
 *
 * Run on a schedule (every hour by default).
 */
export async function runChatMediaPurge(): Promise<void> {
  try {
    const now = new Date();

    // Find messages that have at least one attachment whose retention elapsed
    // and which still has a publicId (i.e. hasn't been purged yet).
    const candidates = await Message.find({
      attachments: {
        $elemMatch: {
          expired: { $ne: true },
          expiresAt: { $lte: now },
          publicId: { $exists: true, $ne: null },
        },
      },
    }).select('_id attachments');

    if (candidates.length === 0) return;

    let purgedCount = 0;
    let failedCount = 0;

    for (const message of candidates) {
      let mutated = false;
      for (const att of message.attachments) {
        if (
          att.expired ||
          !att.expiresAt ||
          att.expiresAt.getTime() > now.getTime() ||
          !att.publicId
        ) {
          continue;
        }

        try {
          await cloudinary.uploader.destroy(att.publicId, {
            resource_type: att.resourceType || 'image',
            invalidate: true,
          });
        } catch (err) {
          console.error(
            `[chatMediaPurge] Cloudinary destroy failed for ${att.publicId}:`,
            err
          );
          failedCount++;
          // Still mark expired so we don't retry forever — admin can manually
          // check the Cloudinary dashboard if a file survives.
        }

        att.expired = true;
        // Null out the url so the client can't serve stale links
        att.url = undefined;
        att.publicId = undefined;
        mutated = true;
        purgedCount++;
      }

      if (mutated) {
        await message.save();
      }
    }

    if (purgedCount > 0) {
      console.log(
        `[chatMediaPurge] Purged ${purgedCount} attachment(s)` +
          (failedCount > 0 ? ` (${failedCount} Cloudinary deletes failed)` : '')
      );
    }
  } catch (err) {
    console.error('[chatMediaPurge] Job error:', err);
  }
}

/** Start the purge job on an interval (default: every hour). */
export function startChatMediaPurge(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  runChatMediaPurge();
  return setInterval(runChatMediaPurge, intervalMs);
}
