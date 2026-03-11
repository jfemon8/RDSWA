import mongoose, { Schema, Document } from 'mongoose';

export interface IJoinRequest {
  user: mongoose.Types.ObjectId;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  requestedAt: Date;
}

export interface IChatGroupDocument extends Document {
  name: string;
  description?: string;
  type: 'central' | 'department' | 'custom';
  department?: string;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  joinRequests: IJoinRequest[];
  avatar?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const joinRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatGroupSchema = new Schema<IChatGroupDocument>(
  {
    name: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['central', 'department', 'custom'], default: 'custom' },
    department: String,
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    joinRequests: [joinRequestSchema],
    avatar: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatGroupSchema.index({ type: 1, department: 1 });
chatGroupSchema.index({ 'joinRequests.status': 1 });

export const ChatGroup = mongoose.model<IChatGroupDocument>('ChatGroup', chatGroupSchema);
