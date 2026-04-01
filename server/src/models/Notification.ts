import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  recipient: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'member_approved', 'member_rejected', 'role_changed', 'event_reminder',
        'vote_opened', 'vote_closed', 'donation_received', 'form_status',
        'notice_published', 'announcement', 'system', 'message', 'skill_endorsed',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// TTL: auto-delete after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotificationDocument>('Notification', notificationSchema);
