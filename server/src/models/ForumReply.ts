import mongoose, { Schema, Document } from 'mongoose';

export interface IForumReplyDocument extends Document {
  topic: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
}

const forumReplySchema = new Schema<IForumReplyDocument>(
  {
    topic: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

forumReplySchema.index({ topic: 1, createdAt: 1 });

export const ForumReply = mongoose.model<IForumReplyDocument>('ForumReply', forumReplySchema);
