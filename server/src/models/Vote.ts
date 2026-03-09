import mongoose, { Schema, Document } from 'mongoose';

export interface IVoteDocument extends Document {
  title: string;
  description?: string;
  options: Array<{
    _id: mongoose.Types.ObjectId;
    text: string;
    voteCount: number;
  }>;
  startTime: Date;
  endTime: Date;
  status: 'draft' | 'active' | 'closed' | 'published';
  eligibleVoters: 'all_members' | 'batch_specific' | 'role_specific';
  eligibleBatches: number[];
  eligibleRoles: string[];
  voters: Array<{
    user: mongoose.Types.ObjectId;
    selectedOption: mongoose.Types.ObjectId;
    votedAt: Date;
    skipped: boolean;
  }>;
  totalVotes: number;
  isResultPublic: boolean;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const voteSchema = new Schema<IVoteDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    options: [
      {
        text: { type: String, required: true },
        voteCount: { type: Number, default: 0 },
      },
    ],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'active', 'closed', 'published'], default: 'draft' },
    eligibleVoters: { type: String, enum: ['all_members', 'batch_specific', 'role_specific'], default: 'all_members' },
    eligibleBatches: [Number],
    eligibleRoles: [String],
    voters: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        selectedOption: Schema.Types.ObjectId,
        votedAt: { type: Date, default: Date.now },
        skipped: { type: Boolean, default: false },
      },
    ],
    totalVotes: { type: Number, default: 0 },
    isResultPublic: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

voteSchema.index({ status: 1 });
voteSchema.index({ endTime: 1 });
voteSchema.index({ 'voters.user': 1 });

export const Vote = mongoose.model<IVoteDocument>('Vote', voteSchema);
