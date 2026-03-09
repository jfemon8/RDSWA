import mongoose, { Schema, Document } from 'mongoose';

export interface IChatGroupDocument extends Document {
  name: string;
  type: 'central' | 'department' | 'custom';
  department?: string;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  avatar?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chatGroupSchema = new Schema<IChatGroupDocument>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['central', 'department', 'custom'], default: 'custom' },
    department: String,
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    avatar: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ChatGroup = mongoose.model<IChatGroupDocument>('ChatGroup', chatGroupSchema);
