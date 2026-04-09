import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduleBus {
  operator: mongoose.Types.ObjectId;
  busName?: string;
  busCategory: 'ac' | 'non_ac' | 'sleeper' | 'economy';
}

export interface IBusScheduleDocument extends Document {
  route: mongoose.Types.ObjectId;
  buses: IScheduleBus[];
  departureTime: string;
  arrivalTime?: string;
  daysOfOperation: string[];
  isSpecialSchedule: boolean;
  specialScheduleNote?: string;
  seasonalVariation?: {
    season: string;
    startDate?: Date;
    endDate?: Date;
    adjustedDepartureTime?: string;
    adjustedArrivalTime?: string;
    note?: string;
  };
  additionalInfo?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleBusSchema = new Schema<IScheduleBus>(
  {
    operator: { type: Schema.Types.ObjectId, ref: 'BusOperator', required: true },
    busName: String,
    busCategory: { type: String, enum: ['ac', 'non_ac', 'sleeper', 'economy'], default: 'non_ac' },
  },
  { _id: false }
);

const busScheduleSchema = new Schema<IBusScheduleDocument>(
  {
    route: { type: Schema.Types.ObjectId, ref: 'BusRoute', required: true },
    buses: { type: [scheduleBusSchema], default: [] },
    departureTime: { type: String, required: true },
    arrivalTime: String,
    daysOfOperation: [{ type: String, enum: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] }],
    isSpecialSchedule: { type: Boolean, default: false },
    specialScheduleNote: String,
    seasonalVariation: {
      season: String,
      startDate: Date,
      endDate: Date,
      adjustedDepartureTime: String,
      adjustedArrivalTime: String,
      note: String,
    },
    additionalInfo: String,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

busScheduleSchema.index({ route: 1, isActive: 1 });
busScheduleSchema.index({ departureTime: 1 });
busScheduleSchema.index({ 'buses.busCategory': 1 });
busScheduleSchema.index({ 'buses.operator': 1 });
busScheduleSchema.index({ isDeleted: 1, isActive: 1 });

export const BusSchedule = mongoose.model<IBusScheduleDocument>('BusSchedule', busScheduleSchema);
