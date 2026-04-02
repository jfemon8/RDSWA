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
      // Auto-close and auto-publish so results are immediately visible
      await Vote.updateMany(
        { _id: { $in: expiredVotes.map((v) => v._id) } },
        { $set: { status: 'published', isResultPublic: true } }
      );

      // Broadcast status change to all watchers
      for (const vote of expiredVotes) {
        broadcastVoteStatus((vote._id as any).toString(), 'published');
      }

      console.log(`Vote closer: closed & published ${expiredVotes.length} expired votes`);
    }
  } catch (err) {
    console.error('Vote closer error:', err);
  }
}

export function startVoteCloser(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  runVoteCloser();
  return setInterval(runVoteCloser, intervalMs);
}
