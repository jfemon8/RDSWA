import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetDocument extends Document {
  title: string;
  description?: string;
  event?: mongoose.Types.ObjectId;
  totalAmount: number;
  items: Array<{
    category: string;
    description: string;
    estimatedAmount: number;
    actualAmount?: number;
  }>;
  status: 'draft' | 'approved' | 'rejected' | 'executed';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  fiscalYear: string;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudgetDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    totalAmount: { type: Number, required: true },
    items: [
      {
        category: { type: String, required: true },
        description: { type: String, required: true },
        estimatedAmount: { type: Number, required: true },
        actualAmount: Number,
      },
    ],
    status: { type: String, enum: ['draft', 'approved', 'rejected', 'executed'], default: 'draft' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    fiscalYear: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetSchema.index({ event: 1 });
budgetSchema.index({ fiscalYear: 1 });
budgetSchema.index({ status: 1 });

export const Budget = mongoose.model<IBudgetDocument>('Budget', budgetSchema);
