import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLogDocument extends Document {
  actor?: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: mongoose.Types.ObjectId;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: Schema.Types.ObjectId,
    changes: {
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed,
    },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
// TTL: auto-delete after 365 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
