import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

export interface IAdmissionCircularAttachment {
  name: string;
  url: string;
  type?: string;
}

export interface IAdmissionCircularExternalLink {
  label: string;
  url: string;
}

export interface IAdmissionCircularDocument extends MongoDoc {
  title: string;
  content?: string;
  session: string;
  applicationStartDate?: Date;
  applicationDeadline?: Date;
  examDate?: Date;
  resultDate?: Date;
  attachments: IAdmissionCircularAttachment[];
  externalLinks: IAdmissionCircularExternalLink[];
  isPublished: boolean;
  publishedAt?: Date;
  pinned: boolean;
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAdmissionCircularAttachment>(
  { name: String, url: String, type: String },
  { _id: false }
);

const externalLinkSchema = new Schema<IAdmissionCircularExternalLink>(
  { label: String, url: String },
  { _id: false }
);

const admissionCircularSchema = new Schema<IAdmissionCircularDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: String,
    session: { type: String, required: true, trim: true, index: true },
    applicationStartDate: Date,
    applicationDeadline: Date,
    examDate: Date,
    resultDate: Date,
    attachments: { type: [attachmentSchema], default: [] },
    externalLinks: { type: [externalLinkSchema], default: [] },
    isPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: () => new Date() },
    pinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

admissionCircularSchema.index({ pinned: -1, publishedAt: -1 });

export const AdmissionCircular = mongoose.model<IAdmissionCircularDocument>(
  'AdmissionCircular',
  admissionCircularSchema
);
