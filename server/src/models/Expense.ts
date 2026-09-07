import mongoose, { Schema, Document } from 'mongoose';

/** One head the money went to, so a single expense can be broken down without becoming several records. */
export interface IExpenseItem {
  head: string;
  amount: number;
  note?: string;
}

/** A receipt or other proof backing the expense. */
export interface IExpenseAttachment {
  name: string;
  url: string;
  type?: string;
}

export interface IExpenseDocument extends Document {
  title: string;
  description?: string;
  amount: number;
  category: 'event' | 'office' | 'transport' | 'food' | 'printing' | 'other';
  expenseDate: Date;
  items: IExpenseItem[];
  attachments: IExpenseAttachment[];
  event?: mongoose.Types.ObjectId;
  committee?: mongoose.Types.ObjectId;
  receiptUrl?: string;
  approvedBy?: mongoose.Types.ObjectId;
  paidBy?: mongoose.Types.ObjectId;
  paidAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseItemSchema = new Schema<IExpenseItem>(
  { head: String, amount: Number, note: String },
  { _id: false }
);

// Declared as its own schema because a bare `type` key would otherwise collapse the subdocument to [String].
const expenseAttachmentSchema = new Schema<IExpenseAttachment>(
  { name: String, url: String, type: String },
  { _id: false }
);

const expenseSchema = new Schema<IExpenseDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    amount: { type: Number, required: true },
    category: { type: String, enum: ['event', 'office', 'transport', 'food', 'printing', 'other'], default: 'other' },
    expenseDate: { type: Date, default: Date.now },
    items: { type: [expenseItemSchema], default: [] },
    attachments: { type: [expenseAttachmentSchema], default: [] },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    committee: { type: Schema.Types.ObjectId, ref: 'Committee' },
    receiptUrl: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ event: 1 });
expenseSchema.index({ committee: 1 });

export const Expense = mongoose.model<IExpenseDocument>('Expense', expenseSchema);
