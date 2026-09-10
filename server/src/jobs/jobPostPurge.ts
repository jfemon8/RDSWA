import { JobPost } from '../models';
import { cloudinary } from '../config/cloudinary';
import { cloudinaryPublicId } from '../utils/cloudinaryPublicId';

/** A listing with no deadline of its own closes one month after it was posted. */
export const DEFAULT_JOB_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

/** A listing is kept for a year after it was posted, long past the deadline that closed it. */
export const JOB_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

/** Deletes year-old job posts outright and takes their uploaded circular out of Cloudinary with them. */
export async function runJobPostPurge(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - JOB_RETENTION_MS);
    const expired = await JobPost.find({ createdAt: { $lte: cutoff } }).select('_id image');
    if (expired.length === 0) return;

    let removed = 0;
    let imagesFailed = 0;

    for (const job of expired) {
      const publicId = cloudinaryPublicId(job.image);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
        } catch (err) {
          console.error(`[JobPostPurge] Cloudinary destroy failed for ${publicId}:`, err);
          imagesFailed += 1;
          // The row is still dropped, since keeping it only to retry an orphaned asset is worse.
        }
      }

      await JobPost.deleteOne({ _id: job._id });
      removed += 1;
    }

    console.log(
      `[JobPostPurge] Removed ${removed} job post(s) older than a year` +
        (imagesFailed > 0 ? ` (${imagesFailed} Cloudinary delete(s) failed)` : ''),
    );
  } catch (err) {
    console.error('[JobPostPurge] Job error:', err);
  }
}

/** Start the purge on an interval (default: once a day). */
export function startJobPostPurge(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  runJobPostPurge();
  return setInterval(runJobPostPurge, intervalMs);
}
