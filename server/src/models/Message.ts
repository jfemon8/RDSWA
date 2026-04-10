import mongoose, { Schema, Document } from 'mongoose';

/**
 * Attachment types supported on chat messages.
 * Media kinds (image/video/audio/pdf/file) are stored in Cloudinary and auto-expire.
 * Contact is a lightweight inline reference to a user — no file, no expiry.
 */
export type MessageAttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file' | 'contact';

export interface IMessageAttachment {
  kind: MessageAttachmentKind;
  /** File URL (Cloudinary secure_url for media, undefined for contact) */
  url?: string;
  /** Cloudinary public_id — used by the purge job to delete the file */
  publicId?: string;
  /** Cloudinary resource_type ('image' | 'video' | 'raw') — needed to call destroy */
  resourceType?: 'image' | 'video' | 'raw';
  /** Original filename (e.g. "report.pdf") */
  name?: string;
  /** MIME type (e.g. "video/mp4") */
  mimeType?: string;
  /** Size in bytes */
  size?: number;
  /** Image/video width (pixels) */
  width?: number;
  /** Image/video height (pixels) */
  height?: number;
  /** Video/audio duration (seconds) */
  duration?: number;
  /** Date after which the file is eligible for auto-purge */
  expiresAt?: Date;
  /** True once the purge job has deleted the file from storage */
  expired?: boolean;
  /** Contact-kind fields */
  contact?: {
    userId?: mongoose.Types.ObjectId;
    name: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
}

export interface IMessageDocument extends Document {
  group?: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipient?: mongoose.Types.ObjectId;
  content: string;
  attachments: IMessageAttachment[];
  isRead: boolean;
  readBy: Array<{ user: mongoose.Types.ObjectId; readAt: Date }>;
  isDeleted: boolean;
  /** Per-user "delete for me" — users in this list will not see this message */
  deletedFor: mongoose.Types.ObjectId[];
  /** Whether message content was edited after the original send */
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IMessageAttachment>(
  {
    kind: {
      type: String,
      enum: ['image', 'video', 'audio', 'pdf', 'file', 'contact'],
      required: true,
    },
    url: String,
    publicId: String,
    resourceType: { type: String, enum: ['image', 'video', 'raw'] },
    name: String,
    mimeType: String,
    size: Number,
    width: Number,
    height: Number,
    duration: Number,
    expiresAt: Date,
    expired: { type: Boolean, default: false },
    contact: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: String,
      phone: String,
      email: String,
      avatar: String,
    },
  },
  { _id: true }
);

const messageSchema = new Schema<IMessageDocument>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'ChatGroup' },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    // Content is optional — a message may have just an attachment.
    // The route handlers enforce "at least one of content or attachments".
    content: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    isRead: { type: Boolean, default: false },
    readBy: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, readAt: Date }],
    isDeleted: { type: Boolean, default: false },
    deletedFor: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
// Purge job scans expiring attachments — this index makes that cheap.
messageSchema.index({ 'attachments.expiresAt': 1, 'attachments.expired': 1 });

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);
