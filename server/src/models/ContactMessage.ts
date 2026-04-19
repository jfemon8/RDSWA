import mongoose, { Schema, Document } from 'mongoose';

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'archived';

export interface IContactMessageDocument extends Document {
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  reply?: string;
  repliedBy?: mongoose.Types.ObjectId;
  repliedAt?: Date;
  readAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessageDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'archived'],
      default: 'new',
      index: true,
    },
    reply: { type: String, maxlength: 10000 },
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    repliedAt: Date,
    readAt: Date,
    ipAddress: String,
    userAgent: String,
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1, createdAt: -1 });

export const ContactMessage = mongoose.model<IContactMessageDocument>('ContactMessage', contactMessageSchema);
