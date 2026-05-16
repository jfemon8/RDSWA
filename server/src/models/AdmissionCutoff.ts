import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

export type AdmissionUnit = 'A' | 'B' | 'C';

/**
 * Cut-off mark row for a (faculty, department, unit) combination in a given
 * admission session. Faculty + department strings are matched against the
 * SiteSettings.academicConfig.faculties list — the admin form picks from
 * existing values rather than introducing parallel taxonomies.
 *
 * The 4 numeric fields are kept optional because some units / departments
 * have no advertised cut-off (e.g., Engineering has only A-unit data) and
 * the UI shows "x" / "—" placeholders for empty cells.
 */
export interface IAdmissionCutoffDocument extends MongoDoc {
  faculty: string;
  department: string;
  unit: AdmissionUnit;
  firstPositionMerit?: number;
  firstPositionScore?: number;
  lastPositionMerit?: number;
  lastPositionScore?: number;
  dataSource?: string;
  session: string;
  sortOrder: number;
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const admissionCutoffSchema = new Schema<IAdmissionCutoffDocument>(
  {
    faculty: { type: String, required: true, trim: true, index: true },
    department: { type: String, required: true, trim: true, index: true },
    unit: { type: String, enum: ['A', 'B', 'C'], required: true },
    firstPositionMerit: { type: Number, min: 0 },
    firstPositionScore: { type: Number, min: 0 },
    lastPositionMerit: { type: Number, min: 0 },
    lastPositionScore: { type: Number, min: 0 },
    dataSource: { type: String, trim: true },
    session: { type: String, required: true, trim: true, index: true },
    sortOrder: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// One row per (session, faculty, department, unit) — uniqueness on the
// non-deleted slice so a row that's soft-deleted doesn't block re-creation.
admissionCutoffSchema.index(
  { session: 1, faculty: 1, department: 1, unit: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export const AdmissionCutoff = mongoose.model<IAdmissionCutoffDocument>(
  'AdmissionCutoff',
  admissionCutoffSchema
);
