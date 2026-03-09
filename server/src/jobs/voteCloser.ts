import { Vote } from '../models';

/**
 * Auto-close expired votes.
 * Run on a schedule (e.g., every 5 minutes).
 */
export async function runVoteCloser(): Promise<void> {
  try {
    const result = await Vote.updateMany(
      {
        status: 'active',
        endTime: { $lte: new Date() },
        isDeleted: false,
      },
      { $set: { status: 'closed' } }
    );

    if (result.modifiedCount > 0) {
      console.log(`Vote closer: closed ${result.modifiedCount} expired votes`);
    }
  } catch (err) {
    console.error('Vote closer error:', err);
  }
}

export function startVoteCloser(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  runVoteCloser();
  return setInterval(runVoteCloser, intervalMs);
}
