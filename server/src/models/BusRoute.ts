import mongoose, { Schema, Document } from 'mongoose';

export interface IBusRouteDocument extends Document {
  origin: string;
  destination: string;
  stops: Array<{ name: string; order: number }>;
  distanceKm?: number;
  estimatedDuration?: string;
  routeType: 'university' | 'intercity';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const busRouteSchema = new Schema<IBusRouteDocument>(
  {
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    stops: [{ name: String, order: Number }],
    distanceKm: Number,
    estimatedDuration: String,
    routeType: { type: String, enum: ['university', 'intercity'], required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

busRouteSchema.index({ origin: 1, destination: 1 });
busRouteSchema.index({ routeType: 1 });

export const BusRoute = mongoose.model<IBusRouteDocument>('BusRoute', busRouteSchema);
