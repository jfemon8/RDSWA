import mongoose, { Schema, Document } from 'mongoose';

export interface IFormDocument extends Document {
  type: 'membership' | 'construction_fund' | 'alumni';
  submittedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  data: Record<string, unknown>;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewComment?: string;
  attachments: Array<{ name: string; url: string }>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const formSchema = new Schema<IFormDocument>(
  {
    type: { type: String, enum: ['membership', 'construction_fund', 'alumni'], required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected'], default: 'pending' },
    data: { type: Schema.Types.Mixed, default: {} },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: String,
    attachments: [{ name: String, url: String }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

formSchema.index({ type: 1, status: 1 });
formSchema.index({ submittedBy: 1 });

export const Form = mongoose.model<IFormDocument>('Form', formSchema);
