import mongoose, { Schema, Document } from 'mongoose';

export interface IMentorshipDocument extends Document {
  mentor: mongoose.Types.ObjectId;
  mentee: mongoose.Types.ObjectId;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  area?: string;
  requestedAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mentorshipSchema = new Schema<IMentorshipDocument>(
  {
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled'], default: 'pending' },
    area: String,
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

export const Mentorship = mongoose.model<IMentorshipDocument>('Mentorship', mentorshipSchema);
