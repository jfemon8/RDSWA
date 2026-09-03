import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

/** Per-university seat row whose `category` is stored inline rather than as its own collection, so admins add one just by typing it. */
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

// A convenience virtual total that is never persisted, since the UI computes its own.
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
