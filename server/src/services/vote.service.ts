import { Vote, IVoteDocument, IUserDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@rdswa/shared';
import mongoose from 'mongoose';
import { broadcastVoteUpdate, broadcastVoteStatus } from '../socket';

export class VoteService {
  async list() {
    return Vote.find({ isDeleted: false, status: { $in: ['active', 'closed', 'published'] } })
      .select('-voters')
      .sort({ createdAt: -1 });
  }

  async getById(id: string): Promise<IVoteDocument> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    return vote;
  }

  async create(data: any, createdBy: string): Promise<IVoteDocument> {
    return Vote.create({ ...data, createdBy });
  }

  async update(id: string, data: any): Promise<IVoteDocument> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status === 'closed' || vote.status === 'published') {
      throw ApiError.badRequest('Cannot edit a closed or published vote');
    }
    Object.assign(vote, data);
    await vote.save();
    return vote;
  }

  async castVote(voteId: string, user: IUserDocument, optionId: string): Promise<void> {
    const vote = await Vote.findOne({ _id: voteId, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'active') throw ApiError.badRequest('This vote is not currently active');

    // Check eligibility
    if (vote.eligibleVoters === 'batch_specific' && user.batch) {
      if (!vote.eligibleBatches.includes(user.batch)) {
        throw ApiError.forbidden('You are not eligible to vote in this poll');
      }
    }
    if (vote.eligibleVoters === 'role_specific') {
      if (!vote.eligibleRoles.includes(user.role)) {
        throw ApiError.forbidden('You are not eligible to vote in this poll');
      }
    }

    const userId = (user._id as any).toString();
    const alreadyVoted = vote.voters.some((v) => v.user.toString() === userId);
    if (alreadyVoted) throw ApiError.conflict('You have already voted');

    const option = vote.options.find((o) => (o._id as any).toString() === optionId);
    if (!option) throw ApiError.notFound('Vote option not found');

    vote.voters.push({
      user: new mongoose.Types.ObjectId(userId),
      selectedOption: new mongoose.Types.ObjectId(optionId),
      votedAt: new Date(),
      skipped: false,
    } as any);

    option.voteCount += 1;
    vote.totalVotes += 1;
    await vote.save();

    // Broadcast real-time update
    broadcastVoteUpdate(voteId, {
      totalVotes: vote.totalVotes,
      options: vote.options.map((o) => ({
        _id: (o._id as any).toString(),
        text: o.text,
        voteCount: o.voteCount,
      })),
    });
  }

  async getResults(id: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status === 'active' || vote.status === 'draft') {
      throw ApiError.badRequest('Results are not available yet');
    }

    return {
      title: vote.title,
      totalVotes: vote.totalVotes,
      options: vote.options.map((o) => ({
        text: o.text,
        voteCount: o.voteCount,
        percentage: vote.totalVotes > 0 ? ((o.voteCount / vote.totalVotes) * 100).toFixed(1) : '0',
      })),
      status: vote.status,
      isResultPublic: vote.isResultPublic,
    };
  }

  async getStats(id: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false })
      .populate('voters.user', 'name batch role department');
    if (!vote) throw ApiError.notFound('Vote not found');

    const voters = vote.voters || [];
    const totalVoters = voters.length;
    const skippedCount = voters.filter((v) => v.skipped).length;

    // Participation by batch
    const byBatch: Record<number, number> = {};
    const byRole: Record<string, number> = {};
    for (const v of voters) {
      const u = v.user as any;
      if (u?.batch) byBatch[u.batch] = (byBatch[u.batch] || 0) + 1;
      if (u?.role) byRole[u.role] = (byRole[u.role] || 0) + 1;
    }

    return {
      voteId: id,
      title: vote.title,
      status: vote.status,
      totalVotes: vote.totalVotes,
      totalVoters,
      skippedCount,
      byBatch: Object.entries(byBatch).map(([batch, count]) => ({ batch: Number(batch), count })).sort((a, b) => a.batch - b.batch),
      byRole: Object.entries(byRole).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
      voters: voters.map((v) => {
        const u = v.user as any;
        return {
          name: u?.name || 'Unknown',
          batch: u?.batch,
          role: u?.role,
          votedAt: v.votedAt,
          skipped: v.skipped,
        };
      }),
    };
  }

  async publishResults(id: string): Promise<IVoteDocument> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'closed') throw ApiError.badRequest('Vote must be closed first');

    vote.status = 'published';
    vote.isResultPublic = true;
    await vote.save();

    broadcastVoteStatus(id, 'published');
    return vote;
  }

  async closeManually(id: string): Promise<IVoteDocument> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'active') throw ApiError.badRequest('Only active votes can be closed');

    vote.status = 'closed';
    await vote.save();

    broadcastVoteStatus(id, 'closed');
    return vote;
  }
}

export const voteService = new VoteService();
