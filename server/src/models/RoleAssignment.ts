import mongoose, { Schema, Document } from 'mongoose';

export interface IRoleAssignmentDocument extends Document {
  user: mongoose.Types.ObjectId;
  role: string;
  previousRole: string;
  assignmentType: 'auto' | 'manual';
  reason: string;
  assignedBy?: mongoose.Types.ObjectId;
  removedAt?: Date;
  removedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const roleAssignmentSchema = new Schema<IRoleAssignmentDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    previousRole: { type: String, required: true },
    assignmentType: { type: String, enum: ['auto', 'manual'], required: true },
    reason: { type: String, required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    removedAt: Date,
    removedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

roleAssignmentSchema.index({ user: 1 });
roleAssignmentSchema.index({ role: 1 });

export const RoleAssignment = mongoose.model<IRoleAssignmentDocument>('RoleAssignment', roleAssignmentSchema);
