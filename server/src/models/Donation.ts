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
  senderNumber?: string;
  transactionId?: string;
  senderBankName?: string;
  senderAccountNumber?: string;
  cashDate?: string;
  cashTime?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'revision';
  revisionNote?: string;
  paymentVerifiedBy?: mongoose.Types.ObjectId;
  paymentVerifiedAt?: Date;
  visibility: 'public' | 'private';
  receiptNumber?: string;
  receiptUrl?: string;
  note?: string;
  isRecurring: boolean;
  recurringInterval?: 'monthly' | 'yearly';
  nextPaymentDate?: Date;
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
    senderNumber: String,
    transactionId: String,
    senderBankName: String,
    senderAccountNumber: String,
    cashDate: String,
    cashTime: String,
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded', 'revision'], default: 'pending' },
    revisionNote: String,
    paymentVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paymentVerifiedAt: Date,
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    receiptNumber: String,
    receiptUrl: String,
    note: String,
    isRecurring: { type: Boolean, default: false },
    recurringInterval: { type: String, enum: ['monthly', 'yearly'] },
    nextPaymentDate: Date,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

donationSchema.index({ donor: 1 });
donationSchema.index({ type: 1 });
donationSchema.index({ campaign: 1 });
donationSchema.index({ paymentStatus: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ isRecurring: 1, nextPaymentDate: 1 });

export const Donation = mongoose.model<IDonationDocument>('Donation', donationSchema);
