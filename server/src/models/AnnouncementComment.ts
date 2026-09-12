import mongoose, { Schema, Document } from 'mongoose';

/** One person's reaction to a comment, capped at one per person the way the announcement itself is. */
export interface ICommentReaction {
  user: mongoose.Types.ObjectId;
  type: string;
  reactedAt: Date;
}

export interface IAnnouncementCommentDocument extends Document {
  /** The announcement message this belongs to. */
  announcement: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  /** Set on a reply, pointing at the top-level comment it answers, replies never nest further. */
  parent?: mongoose.Types.ObjectId;
  reactions: ICommentReaction[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentReactionSchema = new Schema<ICommentReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const announcementCommentSchema = new Schema<IAnnouncementCommentDocument>(
  {
    announcement: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: 'AnnouncementComment' },
    reactions: { type: [commentReactionSchema], default: [] },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

announcementCommentSchema.index({ announcement: 1, parent: 1, createdAt: 1 });

export const AnnouncementComment = mongoose.model<IAnnouncementCommentDocument>(
  'AnnouncementComment',
  announcementCommentSchema
);
