import mongoose, { Schema, Document } from 'mongoose';

export interface IJobPostDocument extends Document {
  title: string;
  company: string;
  location?: string;
  type: 'full-time' | 'part-time' | 'internship' | 'remote' | 'contract';
  description: string;
  requirements: string[];
  salary?: string;
  applicationLink?: string;
  postedBy: mongoose.Types.ObjectId;
  expiresAt?: Date;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jobPostSchema = new Schema<IJobPostDocument>(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true },
    location: String,
    type: { type: String, enum: ['full-time', 'part-time', 'internship', 'remote', 'contract'], required: true },
    description: { type: String, required: true },
    requirements: [String],
    salary: String,
    applicationLink: String,
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const JobPost = mongoose.model<IJobPostDocument>('JobPost', jobPostSchema);
