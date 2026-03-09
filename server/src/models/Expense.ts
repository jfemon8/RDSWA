import mongoose, { Schema, Document } from 'mongoose';

export interface IExpenseDocument extends Document {
  title: string;
  description?: string;
  amount: number;
  category: 'event' | 'office' | 'transport' | 'food' | 'printing' | 'other';
  event?: mongoose.Types.ObjectId;
  receiptUrl?: string;
  approvedBy?: mongoose.Types.ObjectId;
  paidBy?: mongoose.Types.ObjectId;
  paidAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpenseDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    amount: { type: Number, required: true },
    category: { type: String, enum: ['event', 'office', 'transport', 'food', 'printing', 'other'], default: 'other' },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    receiptUrl: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpenseDocument>('Expense', expenseSchema);
