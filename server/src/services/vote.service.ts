import { Vote, IVoteDocument, IUserDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { UserRole, ROLE_HIERARCHY, isEligibleVoter } from '@rdswa/shared';
import mongoose from 'mongoose';
import { broadcastVoteUpdate, broadcastVoteStatus } from '../socket';

function isModeratorPlus(role?: string): boolean {
  return !!role && ROLE_HIERARCHY.indexOf(role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
}

function hasParticipated(voters: Array<{ user: any }> | undefined, userId?: string): boolean {
  return !!userId && (voters || []).some((v) => v.user?.toString() === userId);
}

/** Tallies follow the voting page: moderators always, everyone once published, otherwise only members who already voted or skipped. */
function canSeeTallies(vote: { status: string; isResultPublic?: boolean }, participated: boolean, role?: string): boolean {
  return isModeratorPlus(role) || vote.status === 'published' || !!vote.isResultPublic || participated;
}

/** Drops `voters` from a general-purpose response, since which option each member chose is for SuperAdmin alone, through stats. */
function withoutVoters(vote: any): any {
  const plain = typeof vote?.toObject === 'function' ? vote.toObject() : vote;
  const { voters, ...rest } = plain;
  return rest;
}

/** Shapes a poll for a member, hiding its tallies until they are allowed to see them. */
function toMemberView(vote: any, userId?: string, role?: string): any {
  const participated = hasParticipated(vote.voters, userId);
  const view = { ...withoutVoters(vote), hasVoted: participated };
  if (canSeeTallies(vote, participated, role)) return view;

  const { totalVotes, ...hidden } = view;
  return { ...hidden, options: (view.options || []).map(({ voteCount, ...o }: any) => o) };
}

export class VoteService {
  async list(userId?: string, requesterRole?: string): Promise<any[]> {
    const statuses = isModeratorPlus(requesterRole)
      ? ['draft', 'active', 'closed', 'published']
      : ['active', 'closed', 'published'];

    const votes = await Vote.find({ isDeleted: false, status: { $in: statuses } })
      .sort({ createdAt: -1 })
      .lean();

    return votes.map((v) => toMemberView(v, userId, requesterRole));
  }

  async getById(id: string, userId?: string, requesterRole?: string): Promise<any> {
    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    if (!isModeratorPlus(requesterRole)) filter.status = { $ne: 'draft' };

    const vote = await Vote.findOne(filter).lean();
    if (!vote) throw ApiError.notFound('Vote not found');
    return toMemberView(vote, userId, requesterRole);
  }

  async create(data: any, createdBy: string): Promise<IVoteDocument> {
    return Vote.create({ ...data, createdBy });
  }

  async update(id: string, data: any): Promise<IVoteDocument> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status === 'active' || vote.status === 'closed' || vote.status === 'published') {
      throw ApiError.badRequest('Cannot edit a vote that has already started');
    }
    Object.assign(vote, data);
    await vote.save();
    return vote;
  }

  async castVote(voteId: string, user: IUserDocument, optionId: string): Promise<void> {
    const vote = await Vote.findOne({ _id: voteId, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'active') throw ApiError.badRequest('This vote is not currently active');

    if (!isEligibleVoter(vote, user)) {
      throw ApiError.forbidden('You are not eligible to vote in this poll');
    }

    const userId = (user._id as any).toString();
    const alreadyVoted = vote.voters.some((v) => v.user.toString() === userId);
    if (alreadyVoted) throw ApiError.conflict('You have already voted');

    const option = vote.options.find((o) => (o._id as any).toString() === optionId);
    if (!option) throw ApiError.notFound('Vote option not found');

    // One atomic write, since a read-then-save lets two concurrent clicks both pass the check above.
    const recorded = await Vote.findOneAndUpdate(
      { _id: voteId, isDeleted: false, status: 'active', 'voters.user': { $ne: user._id } },
      {
        $push: {
          voters: {
            user: new mongoose.Types.ObjectId(userId),
            selectedOption: new mongoose.Types.ObjectId(optionId),
            votedAt: new Date(),
            skipped: false,
          },
        },
        $inc: { totalVotes: 1, 'options.$[opt].voteCount': 1 },
      },
      { new: true, arrayFilters: [{ 'opt._id': new mongoose.Types.ObjectId(optionId) }] }
    );
    if (!recorded) throw ApiError.conflict('You have already voted');
    vote.totalVotes = recorded.totalVotes;
    vote.options = recorded.options;

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

  async skipVote(voteId: string, user: IUserDocument): Promise<void> {
    const vote = await Vote.findOne({ _id: voteId, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'active') throw ApiError.badRequest('This vote is not currently active');

    if (!isEligibleVoter(vote, user)) {
      throw ApiError.forbidden('You are not eligible for this poll');
    }

    const userId = (user._id as any).toString();
    const alreadyVoted = vote.voters.some((v) => v.user.toString() === userId);
    if (alreadyVoted) throw ApiError.conflict('You have already voted or skipped');

    // Atomic for the same reason as casting: the check and the write must not be separable.
    const recorded = await Vote.findOneAndUpdate(
      { _id: voteId, isDeleted: false, 'voters.user': { $ne: user._id } },
      {
        $push: {
          voters: {
            user: new mongoose.Types.ObjectId(userId),
            selectedOption: new mongoose.Types.ObjectId(), // placeholder, not used
            votedAt: new Date(),
            skipped: true,
          },
        },
      },
      { new: true }
    );
    if (!recorded) throw ApiError.conflict('You have already voted or skipped');
  }

  async getResults(id: string, userId?: string, requesterRole?: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status === 'active' || vote.status === 'draft') {
      throw ApiError.badRequest('Results are not available yet');
    }
    if (!canSeeTallies(vote, hasParticipated(vote.voters, userId), requesterRole)) {
      throw ApiError.forbidden('Results have not been published yet');
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

  async getStats(id: string, requesterRole?: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false })
      .populate('voters.user', 'name batch role department');
    if (!vote) throw ApiError.notFound('Vote not found');

    const voters = vote.voters || [];
    const totalVoters = voters.length;
    const skippedCount = voters.filter((v) => v.skipped).length;

    // Per-option vote counts (always visible to moderators)
    const optionResults = vote.options.map((o) => ({
      _id: (o._id as any).toString(),
      text: o.text,
      voteCount: o.voteCount,
      percentage: vote.totalVotes > 0 ? ((o.voteCount / vote.totalVotes) * 100).toFixed(1) : '0',
    }));

    // Participation by batch
    const byBatch: Record<number, number> = {};
    const byRole: Record<string, number> = {};
    for (const v of voters) {
      const u = v.user as any;
      if (u?.batch) byBatch[u.batch] = (byBatch[u.batch] || 0) + 1;
      if (u?.role) byRole[u.role] = (byRole[u.role] || 0) + 1;
    }

    // Build option lookup for voter-option mapping (SuperAdmin only)
    const isSuperAdmin = requesterRole === UserRole.SUPER_ADMIN;
    const optionMap = new Map(vote.options.map((o) => [(o._id as any).toString(), o.text]));

    return {
      voteId: id,
      title: vote.title,
      status: vote.status,
      totalVotes: vote.totalVotes,
      totalVoters,
      skippedCount,
      options: optionResults,
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
          // Only SuperAdmin can see which option each user selected
          ...(isSuperAdmin && !v.skipped ? { selectedOption: optionMap.get(v.selectedOption.toString()) || 'Unknown' } : {}),
        };
      }),
    };
  }

  async publishResults(id: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'closed') throw ApiError.badRequest('Vote must be closed first');

    vote.status = 'published';
    vote.isResultPublic = true;
    await vote.save();

    broadcastVoteStatus(id, 'published');
    return withoutVoters(vote);
  }

  async closeManually(id: string): Promise<any> {
    const vote = await Vote.findOne({ _id: id, isDeleted: false });
    if (!vote) throw ApiError.notFound('Vote not found');
    if (vote.status !== 'active') throw ApiError.badRequest('Only active votes can be closed');

    vote.status = 'closed';
    await vote.save();

    broadcastVoteStatus(id, 'closed');
    return withoutVoters(vote);
  }
}

export const voteService = new VoteService();
