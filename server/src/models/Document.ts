import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

export interface IDocumentDocument extends MongoDoc {
  title: string;
  description?: string;
  category: 'policy' | 'resolution' | 'report' | 'form' | 'other';
  fileUrl: string;
  fileType: string;
  fileSize: number;
  isPublic: boolean;
  accessRoles: string[];
  downloadCount: number;
  uploadedBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocumentDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, enum: ['policy', 'resolution', 'report', 'form', 'other'], default: 'other' },
    fileUrl: { type: String, required: true },
    fileType: String,
    fileSize: Number,
    isPublic: { type: Boolean, default: true },
    accessRoles: [String],
    downloadCount: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

documentSchema.index({ category: 1 });
documentSchema.index({ isPublic: 1 });

export const DocumentModel = mongoose.model<IDocumentDocument>('Document', documentSchema);
