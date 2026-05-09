import mongoose, { Schema, Document } from 'mongoose';

/**
 * Yearly vacation calendar (e.g. "2026-27") containing a list of events
 * with date ranges and optional supporting attachments. Each `academicYear`
 * is unique — admins update the same record rather than creating duplicates.
 */
export interface IVacationEntry {
  event: string;
  startDate: Date;
  endDate: Date;
  totalDays?: number;
}

export interface IVacationAttachment {
  name: string;
  url: string;
  type: string;
}

export interface IVacationDocument extends Document {
  /** Format: "YYYY-YY", e.g. "2026-27". Validated server-side. */
  academicYear: string;
  notes?: string;
  entries: IVacationEntry[];
  attachments: IVacationAttachment[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const entrySchema = new Schema<IVacationEntry>(
  {
    event: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Stored, not derived — admins occasionally need to override (e.g. when
    // a holiday falls on a Friday and the institution counts the weekend).
    totalDays: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * Attachment sub-schema — same `type` field collision pitfall as Notice.
 * Defined as a real Schema so Mongoose doesn't collapse it to `[String]`.
 */
const attachmentSchema = new Schema<IVacationAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const vacationSchema = new Schema<IVacationDocument>(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
      // Schema-level format guard — defence in depth alongside Zod.
      match: /^\d{4}-\d{2}$/,
    },
    notes: { type: String, trim: true },
    entries: { type: [entrySchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Unique on academicYear + isDeleted so a year can be re-created after a
// soft delete. Partial index excludes soft-deleted docs from uniqueness.
vacationSchema.index(
  { academicYear: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

export const Vacation = mongoose.model<IVacationDocument>('Vacation', vacationSchema);
