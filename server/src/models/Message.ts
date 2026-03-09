import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageDocument extends Document {
  group?: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipient?: mongoose.Types.ObjectId;
  content: string;
  attachments: Array<{ url: string; type: string; name: string }>;
  isRead: boolean;
  readBy: Array<{ user: mongoose.Types.ObjectId; readAt: Date }>;
  isDeleted: boolean;
  createdAt: Date;
}

const messageSchema = new Schema<IMessageDocument>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'ChatGroup' },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
    attachments: [{ url: String, type: String, name: String }],
    isRead: { type: Boolean, default: false },
    readBy: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, readAt: Date }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);
