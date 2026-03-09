import mongoose, { Schema, Document } from 'mongoose';

export interface IBusScheduleDocument extends Document {
  route: mongoose.Types.ObjectId;
  busName?: string;
  busNumber?: string;
  busCategory: 'ac' | 'non_ac' | 'sleeper' | 'economy';
  departureTime: string;
  arrivalTime?: string;
  fare?: number;
  seatType?: string;
  daysOfOperation: string[];
  isSpecialSchedule: boolean;
  specialScheduleNote?: string;
  additionalInfo?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busScheduleSchema = new Schema<IBusScheduleDocument>(
  {
    route: { type: Schema.Types.ObjectId, ref: 'BusRoute', required: true },
    busName: String,
    busNumber: String,
    busCategory: { type: String, enum: ['ac', 'non_ac', 'sleeper', 'economy'], default: 'non_ac' },
    departureTime: { type: String, required: true },
    arrivalTime: String,
    fare: Number,
    seatType: String,
    daysOfOperation: [{ type: String, enum: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] }],
    isSpecialSchedule: { type: Boolean, default: false },
    specialScheduleNote: String,
    additionalInfo: String,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

busScheduleSchema.index({ route: 1, isActive: 1 });
busScheduleSchema.index({ departureTime: 1 });
busScheduleSchema.index({ busCategory: 1 });

export const BusSchedule = mongoose.model<IBusScheduleDocument>('BusSchedule', busScheduleSchema);
