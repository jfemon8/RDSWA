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
  type: 'central' | 'department' | 'custom' | 'consultation';
  department?: string;
  /** For consultation groups: the mentor who owns this group */
  mentorUser?: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  /** User who created a custom group. Undefined for system-managed central/department groups. */
  createdBy?: mongoose.Types.ObjectId;
  /** Users who have muted notifications for this group. Still receive messages. */
  mutedBy: mongoose.Types.ObjectId[];
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
    type: { type: String, enum: ['central', 'department', 'custom', 'consultation'], default: 'custom' },
    department: String,
    mentorUser: { type: Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    mutedBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    joinRequests: [joinRequestSchema],
    avatar: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatGroupSchema.index({ type: 1, department: 1 });
chatGroupSchema.index({ type: 1, mentorUser: 1 });
chatGroupSchema.index({ 'joinRequests.status': 1 });
chatGroupSchema.index({ createdBy: 1 });

export const ChatGroup = mongoose.model<IChatGroupDocument>('ChatGroup', chatGroupSchema);
