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

/** Emoji reaction from a single user. One reaction per user per message. */
export interface IMessageReaction {
  user: mongoose.Types.ObjectId;
  emoji: string;
  reactedAt: Date;
}

/** Denormalized snapshot of the message being replied to, stored on the reply itself. */
export interface IMessageReplySnapshot {
  messageId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  /** Truncated text preview; empty string if original was attachment-only */
  content: string;
  /** The first attachment kind of the original, if any, for preview icon */
  attachmentKind?: MessageAttachmentKind;
}

export interface IMessageDocument extends Document {
  group?: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipient?: mongoose.Types.ObjectId;
  content: string;
  attachments: IMessageAttachment[];
  /** Denormalized quote of the message being replied to */
  replyTo?: IMessageReplySnapshot;
  /** If set, this message was forwarded from the referenced original */
  forwardedFrom?: mongoose.Types.ObjectId;
  /** Emoji reactions — one entry per distinct user */
  reactions: IMessageReaction[];
  /** Users who starred this message (personal bookmark, per-user) */
  starredBy: mongoose.Types.ObjectId[];
  /** If set, the message is pinned in its conversation (group or DM) */
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
  isRead: boolean;
  readBy: Array<{ user: mongoose.Types.ObjectId; readAt: Date }>;
  /** When the recipient actively opened the chat with this message visible */
  deliveredTo: Array<{ user: mongoose.Types.ObjectId; deliveredAt: Date }>;
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

const reactionSchema = new Schema<IMessageReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const replyToSchema = new Schema<IMessageReplySnapshot>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    content: { type: String, default: '' },
    attachmentKind: {
      type: String,
      enum: ['image', 'video', 'audio', 'pdf', 'file', 'contact'],
    },
  },
  { _id: false }
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
    replyTo: { type: replyToSchema, default: undefined },
    forwardedFrom: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: { type: [reactionSchema], default: [] },
    starredBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    pinnedAt: Date,
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isRead: { type: Boolean, default: false },
    readBy: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, readAt: Date }],
    deliveredTo: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, deliveredAt: Date }],
    isDeleted: { type: Boolean, default: false },
    deletedFor: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ group: 1, pinnedAt: -1 });
messageSchema.index({ starredBy: 1, createdAt: -1 });
// Text index for search across content
messageSchema.index({ content: 'text' });
// Purge job scans expiring attachments — this index makes that cheap.
messageSchema.index({ 'attachments.expiresAt': 1, 'attachments.expired': 1 });

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);
