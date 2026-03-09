import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginHistoryDocument extends Document {
  user: mongoose.Types.ObjectId;
  ip?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  success: boolean;
  failureReason?: string;
  createdAt: Date;
}

const loginHistorySchema = new Schema<ILoginHistoryDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ip: String,
    userAgent: String,
    device: String,
    location: String,
    success: { type: Boolean, required: true },
    failureReason: String,
  },
  { timestamps: true }
);

loginHistorySchema.index({ user: 1, createdAt: -1 });

export const LoginHistory = mongoose.model<ILoginHistoryDocument>('LoginHistory', loginHistorySchema);
