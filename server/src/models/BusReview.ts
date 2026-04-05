import mongoose, { Schema, Document } from 'mongoose';

export interface IBusReviewDocument extends Document {
  operator: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busReviewSchema = new Schema<IBusReviewDocument>(
  {
    operator: { type: Schema.Types.ObjectId, ref: 'BusOperator', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One review per user per operator
busReviewSchema.index({ operator: 1, user: 1 }, { unique: true });
busReviewSchema.index({ operator: 1, isDeleted: 1 });

export const BusReview = mongoose.model<IBusReviewDocument>('BusReview', busReviewSchema);
