import mongoose, { Schema, Document } from 'mongoose';

export interface IForumTopicDocument extends Document {
  title: string;
  content: string;
  author: mongoose.Types.ObjectId;
  category?: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastReplyAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const forumTopicSchema = new Schema<IForumTopicDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: String,
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: Date,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ForumTopic = mongoose.model<IForumTopicDocument>('ForumTopic', forumTopicSchema);
