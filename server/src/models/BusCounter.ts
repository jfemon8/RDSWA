import mongoose, { Schema, Document } from 'mongoose';

export interface IBusCounterDocument extends Document {
  operator: mongoose.Types.ObjectId;
  name: string;
  location?: string;
  phoneNumbers: string[];
  bookingLink?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busCounterSchema = new Schema<IBusCounterDocument>(
  {
    operator: { type: Schema.Types.ObjectId, ref: 'BusOperator', required: true },
    name: { type: String, required: true },
    location: String,
    phoneNumbers: [String],
    bookingLink: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BusCounter = mongoose.model<IBusCounterDocument>('BusCounter', busCounterSchema);
