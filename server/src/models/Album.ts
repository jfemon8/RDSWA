import mongoose, { Schema, Document } from 'mongoose';

export interface IAlbumDocument extends Document {
  title: string;
  description?: string;
  coverPhoto?: string;
  event?: mongoose.Types.ObjectId;
  photoCount: number;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const albumSchema = new Schema<IAlbumDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    coverPhoto: String,
    event: { type: Schema.Types.ObjectId, ref: 'Event' },
    photoCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Album = mongoose.model<IAlbumDocument>('Album', albumSchema);
