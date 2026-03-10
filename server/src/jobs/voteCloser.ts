import { Vote } from '../models';
import { broadcastVoteStatus } from '../socket';

/**
 * Auto-close expired votes.
 * Run on a schedule (e.g., every 5 minutes).
 */
export async function runVoteCloser(): Promise<void> {
  try {
    // Find votes to close first (so we can broadcast)
    const expiredVotes = await Vote.find({
      status: 'active',
      endTime: { $lte: new Date() },
      isDeleted: false,
    }).select('_id');

    if (expiredVotes.length > 0) {
      await Vote.updateMany(
        { _id: { $in: expiredVotes.map((v) => v._id) } },
        { $set: { status: 'closed' } }
      );

      // Broadcast status change to all watchers
      for (const vote of expiredVotes) {
        broadcastVoteStatus((vote._id as any).toString(), 'closed');
      }

      console.log(`Vote closer: closed ${expiredVotes.length} expired votes`);
    }
  } catch (err) {
    console.error('Vote closer error:', err);
  }
}

export function startVoteCloser(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  runVoteCloser();
  return setInterval(runVoteCloser, intervalMs);
}
