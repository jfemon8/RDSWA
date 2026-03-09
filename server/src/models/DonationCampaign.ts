import mongoose, { Schema, Document } from 'mongoose';

export interface IDonationCampaignDocument extends Document {
  title: string;
  description?: string;
  targetAmount: number;
  raisedAmount: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled';
  coverImage?: string;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const donationCampaignSchema = new Schema<IDonationCampaignDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    targetAmount: { type: Number, required: true },
    raisedAmount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: Date,
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    coverImage: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const DonationCampaign = mongoose.model<IDonationCampaignDocument>('DonationCampaign', donationCampaignSchema);
