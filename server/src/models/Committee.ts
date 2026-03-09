import mongoose, { Schema, Document } from 'mongoose';

export interface ICommitteeDocument extends Document {
  name: string;
  tenure: {
    startDate: Date;
    endDate?: Date;
  };
  isCurrent: boolean;
  members: Array<{
    user: mongoose.Types.ObjectId;
    position: string;
    positionBn?: string;
    responsibilities?: string;
    joinedAt: Date;
    leftAt?: Date;
  }>;
  description?: string;
  photo?: string;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const committeeSchema = new Schema<ICommitteeDocument>(
  {
    name: { type: String, required: true, trim: true },
    tenure: {
      startDate: { type: Date, required: true },
      endDate: Date,
    },
    isCurrent: { type: Boolean, default: false },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        position: { type: String, required: true },
        positionBn: String,
        responsibilities: String,
        joinedAt: { type: Date, default: Date.now },
        leftAt: Date,
      },
    ],
    description: String,
    photo: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

committeeSchema.index({ isCurrent: 1 });
committeeSchema.index({ 'tenure.startDate': -1 });
committeeSchema.index({ 'members.user': 1 });
committeeSchema.index({ 'members.position': 1 });

export const Committee = mongoose.model<ICommitteeDocument>('Committee', committeeSchema);
