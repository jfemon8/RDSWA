import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

/**
 * Per-university seat allocation row, used by the public Available Seats
 * table on /admission. Universities are grouped by `category` in the UI
 * (e.g., "সাধারণ বিশ্ববিদ্যালয়", "প্রযুক্তি বিশ্ববিদ্যালয়"), so the
 * category string is stored on the row itself rather than as a separate
 * collection — admins can introduce a new category just by typing it in.
 */
export interface IAdmissionSeatDocument extends MongoDoc {
  category: string;
  universityName: string;
  aUnit: number;
  bUnit: number;
  cUnit: number;
  session: string;
  sortOrder: number;
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const admissionSeatSchema = new Schema<IAdmissionSeatDocument>(
  {
    category: { type: String, required: true, trim: true, index: true },
    universityName: { type: String, required: true, trim: true },
    aUnit: { type: Number, default: 0, min: 0 },
    bUnit: { type: Number, default: 0, min: 0 },
    cUnit: { type: Number, default: 0, min: 0 },
    session: { type: String, required: true, trim: true, index: true },
    sortOrder: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Virtual: computed total. UI also computes its own total per-row + a grand
// total, so this is convenience only — never persisted.
admissionSeatSchema.virtual('total').get(function (this: IAdmissionSeatDocument) {
  return (this.aUnit || 0) + (this.bUnit || 0) + (this.cUnit || 0);
});
admissionSeatSchema.set('toJSON', { virtuals: true });
admissionSeatSchema.set('toObject', { virtuals: true });

admissionSeatSchema.index({ session: 1, category: 1, sortOrder: 1, universityName: 1 });

export const AdmissionSeat = mongoose.model<IAdmissionSeatDocument>(
  'AdmissionSeat',
  admissionSeatSchema
);
