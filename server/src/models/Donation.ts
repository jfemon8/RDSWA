import mongoose, { Schema, Document } from 'mongoose';

export interface IDonationDocument extends Document {
  donor?: mongoose.Types.ObjectId;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  amount: number;
  currency: string;
  type: 'one-time' | 'monthly' | 'event-based' | 'construction-fund' | 'membership';
  campaign?: mongoose.Types.ObjectId;
  paymentMethod: 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cash' | 'other';
  transactionId?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentVerifiedBy?: mongoose.Types.ObjectId;
  paymentVerifiedAt?: Date;
  visibility: 'public' | 'private';
  receiptNumber?: string;
  receiptUrl?: string;
  note?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const donationSchema = new Schema<IDonationDocument>(
  {
    donor: { type: Schema.Types.ObjectId, ref: 'User' },
    donorName: String,
    donorEmail: String,
    donorPhone: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    type: { type: String, enum: ['one-time', 'monthly', 'event-based', 'construction-fund', 'membership'], default: 'one-time' },
    campaign: { type: Schema.Types.ObjectId, ref: 'DonationCampaign' },
    paymentMethod: { type: String, enum: ['bkash', 'nagad', 'rocket', 'bank', 'cash', 'other'], required: true },
    transactionId: String,
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    paymentVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paymentVerifiedAt: Date,
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    receiptNumber: String,
    receiptUrl: String,
    note: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

donationSchema.index({ donor: 1 });
donationSchema.index({ type: 1 });
donationSchema.index({ campaign: 1 });
donationSchema.index({ paymentStatus: 1 });
donationSchema.index({ createdAt: -1 });

export const Donation = mongoose.model<IDonationDocument>('Donation', donationSchema);
