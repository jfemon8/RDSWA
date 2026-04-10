import mongoose, { Schema, Document } from 'mongoose';

export interface IJobPostDocument extends Document {
  title: string;
  company: string;
  location?: string;
  type: 'full-time' | 'part-time' | 'internship' | 'remote' | 'contract';
  description: string;
  requirements: string[];
  salary?: string;
  vacancy?: number;
  applicationLink?: string;
  postedBy: mongoose.Types.ObjectId;
  /** Application deadline — after this date the job is considered expired */
  deadline?: Date;
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
    vacancy: { type: Number, min: 1 },
    applicationLink: String,
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deadline: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const JobPost = mongoose.model<IJobPostDocument>('JobPost', jobPostSchema);
