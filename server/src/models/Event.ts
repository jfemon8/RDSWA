import mongoose, { Schema, Document } from 'mongoose';

export interface IEventDocument extends Document {
  title: string;
  titleBn?: string;
  description: string;
  type: 'event' | 'meeting' | 'workshop' | 'seminar' | 'social' | 'other';
  status: 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  venue?: string;
  isOnline: boolean;
  onlineLink?: string;
  registrationRequired: boolean;
  registrationDeadline?: Date;
  maxParticipants?: number;
  registeredUsers: mongoose.Types.ObjectId[];
  qrCode?: string;
  attendance: Array<{
    user: mongoose.Types.ObjectId;
    checkedInAt: Date;
    checkedInVia: 'qr' | 'manual';
    verifiedBy?: mongoose.Types.ObjectId;
  }>;
  feedbackEnabled: boolean;
  feedbacks: Array<{
    user: mongoose.Types.ObjectId;
    rating: number;
    comment?: string;
    submittedAt: Date;
  }>;
  coverImage?: string;
  photos: Array<{
    url: string;
    caption?: string;
    taggedUsers: mongoose.Types.ObjectId[];
    uploadedBy: mongoose.Types.ObjectId;
  }>;
  committee?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEventDocument>(
  {
    title: { type: String, required: true, trim: true },
    titleBn: { type: String, trim: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['event', 'meeting', 'workshop', 'seminar', 'social', 'other'], default: 'event' },
    status: { type: String, enum: ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'], default: 'draft' },
    startDate: { type: Date, required: true },
    endDate: Date,
    venue: String,
    isOnline: { type: Boolean, default: false },
    onlineLink: String,
    registrationRequired: { type: Boolean, default: false },
    registrationDeadline: Date,
    maxParticipants: Number,
    registeredUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    qrCode: String,
    attendance: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        checkedInAt: { type: Date, default: Date.now },
        checkedInVia: { type: String, enum: ['qr', 'manual'] },
        verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    feedbackEnabled: { type: Boolean, default: false },
    feedbacks: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    coverImage: String,
    photos: [
      {
        url: String,
        caption: String,
        taggedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    committee: { type: Schema.Types.ObjectId, ref: 'Committee' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isPublic: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1, startDate: -1 });
eventSchema.index({ type: 1 });
eventSchema.index({ committee: 1 });
eventSchema.index({ 'attendance.user': 1 });

export const Event = mongoose.model<IEventDocument>('Event', eventSchema);
