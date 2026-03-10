import { Notice } from '../models';

/**
 * Auto-publish notices that have a scheduledPublishAt date in the past
 * but are still in 'draft' status.
 *
 * Run on a schedule (e.g., every 5 minutes).
 */
export async function runNoticePublisher(): Promise<void> {
  try {
    const now = new Date();

    const result = await Notice.updateMany(
      {
        status: 'draft',
        isDeleted: false,
        scheduledPublishAt: { $exists: true, $lte: now },
      },
      {
        $set: {
          status: 'published',
          publishedAt: now,
        },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Notice publisher: published ${result.modifiedCount} scheduled notices`);
    }
  } catch (err) {
    console.error('Notice publisher error:', err);
  }
}

export function startNoticePublisher(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  runNoticePublisher();
  return setInterval(runNoticePublisher, intervalMs);
}
