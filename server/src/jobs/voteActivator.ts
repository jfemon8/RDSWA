import { Vote } from '../models';
import { broadcastVoteStatus } from '../socket';

/**
 * Auto-activate draft votes whose startTime has been reached.
 * Run on a schedule (e.g., every 1 minute).
 */
export async function runVoteActivator(): Promise<void> {
  try {
    const now = new Date();
    const pendingVotes = await Vote.find({
      status: 'draft',
      startTime: { $lte: now },
      endTime: { $gt: now },
      isDeleted: false,
    }).select('_id');

    if (pendingVotes.length > 0) {
      await Vote.updateMany(
        { _id: { $in: pendingVotes.map((v) => v._id) } },
        { $set: { status: 'active' } }
      );

      for (const vote of pendingVotes) {
        broadcastVoteStatus((vote._id as any).toString(), 'active');
      }

      console.log(`Vote activator: activated ${pendingVotes.length} votes`);
    }
  } catch (err) {
    console.error('Vote activator error:', err);
  }
}

export function startVoteActivator(intervalMs = 60 * 1000): NodeJS.Timeout {
  runVoteActivator();
  return setInterval(runVoteActivator, intervalMs);
}
