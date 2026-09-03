import mongoose, { Schema, Document } from 'mongoose';

export type EventRegistrationStatus =
  | 'pending'
  | 'confirmed'
  | 'waitlisted'
  | 'interested'
  | 'cancelled';

/** One admin-defined question asked while registering for an event. */
export interface IEventRegistrationField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required: boolean;
}

export interface IEventRegistration {
  user: mongoose.Types.ObjectId;
  registeredAt: Date;
  status: EventRegistrationStatus;
  responses?: Record<string, string>;
  note?: string;
  updatedBy?: mongoose.Types.ObjectId;
}

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
  registrationFields: IEventRegistrationField[];
  registrations: IEventRegistration[];
  qrCode?: string;
  attendance: Array<{
    user: mongoose.Types.ObjectId;
    checkedInAt: Date;
    checkedInVia: 'qr' | 'manual' | 'self';
    verifiedBy?: mongoose.Types.ObjectId;
    status: 'approved' | 'pending';
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
  reports: Array<{
    name: string;
    url: string;
    uploadedBy: mongoose.Types.ObjectId;
    uploadedAt: Date;
  }>;
  committee?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isPublic: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Declared as a real Schema so Mongoose doesn't read its `type` field as a SchemaType and collapse it to `[String]`.
 */
const registrationFieldSchema = new Schema<IEventRegistrationField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'select'], default: 'text' },
    options: [String],
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

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
    registrationFields: { type: [registrationFieldSchema], default: [] },
    registrations: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        registeredAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'waitlisted', 'interested', 'cancelled'],
          default: 'confirmed',
        },
        responses: { type: Schema.Types.Mixed, default: {} },
        note: String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    qrCode: String,
    attendance: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        checkedInAt: { type: Date, default: Date.now },
        checkedInVia: { type: String, enum: ['qr', 'manual', 'self'] },
        verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['approved', 'pending'], default: 'approved' },
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
    reports: [
      {
        name: String,
        url: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
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
eventSchema.index({ 'registrations.user': 1 });

export const Event = mongoose.model<IEventDocument>('Event', eventSchema);
