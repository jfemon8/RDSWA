import mongoose, { Schema, Document } from 'mongoose';

export interface INoticeDocument extends Document {
  title: string;
  titleBn?: string;
  content: string;
  category: 'general' | 'academic' | 'event' | 'urgent' | 'financial' | 'other';
  priority: 'normal' | 'important' | 'urgent';
  status: 'draft' | 'published' | 'archived';
  isHighlighted: boolean;
  publishedAt?: Date;
  scheduledPublishAt?: Date;
  archivedAt?: Date;
  attachments: Array<{ name: string; url: string; type: string }>;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sub-schema for notice attachments. Defined as a real Schema (not an inline
 * object) because the field has a `type` property which would otherwise be
 * interpreted by Mongoose as a SchemaType descriptor — collapsing the whole
 * subdocument into `[String]`. Using `new Schema()` disambiguates the intent.
 */
const noticeAttachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const noticeSchema = new Schema<INoticeDocument>(
  {
    title: { type: String, required: true, trim: true },
    titleBn: { type: String, trim: true },
    content: { type: String, required: true },
    category: { type: String, enum: ['general', 'academic', 'event', 'urgent', 'financial', 'other'], default: 'general' },
    priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    isHighlighted: { type: Boolean, default: false },
    publishedAt: Date,
    scheduledPublishAt: Date,
    archivedAt: Date,
    attachments: { type: [noticeAttachmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

noticeSchema.index({ status: 1, publishedAt: -1 });
noticeSchema.index({ category: 1 });
noticeSchema.index({ isHighlighted: 1 });

export const Notice = mongoose.model<INoticeDocument>('Notice', noticeSchema);
