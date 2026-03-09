import mongoose, { Schema, Document } from 'mongoose';

export interface IPhotoDocument extends Document {
  album: mongoose.Types.ObjectId;
  url: string;
  thumbnail?: string;
  caption?: string;
  taggedUsers: mongoose.Types.ObjectId[];
  uploadedBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
}

const photoSchema = new Schema<IPhotoDocument>(
  {
    album: { type: Schema.Types.ObjectId, ref: 'Album', required: true },
    url: { type: String, required: true },
    thumbnail: String,
    caption: String,
    taggedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

photoSchema.index({ album: 1 });

export const Photo = mongoose.model<IPhotoDocument>('Photo', photoSchema);
