import mongoose, { Schema, Document } from 'mongoose';

export interface IBusOperatorDocument extends Document {
  name: string;
  contactNumber?: string;
  email?: string;
  rating: number;
  description?: string;
  logo?: string;
  scheduleType: 'university' | 'intercity' | 'both';
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busOperatorSchema = new Schema<IBusOperatorDocument>(
  {
    name: { type: String, required: true, trim: true },
    contactNumber: String,
    email: String,
    rating: { type: Number, min: 0, max: 5, default: 0 },
    description: String,
    logo: String,
    scheduleType: { type: String, enum: ['university', 'intercity', 'both'], default: 'intercity' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BusOperator = mongoose.model<IBusOperatorDocument>('BusOperator', busOperatorSchema);
