import { X, Image as ImageIcon, Video, Music, FileText, File as FileIcon, UserRound, Reply } from 'lucide-react';
import type { MessageAttachmentKind } from './ChatAttachmentMenu';

export interface ReplyData {
  messageId?: string;
  senderId?: string;
  senderName: string;
  content: string;
  attachmentKind?: MessageAttachmentKind;
}

interface Props {
  reply: ReplyData;
  /** Called when the user removes the reply — only shown on composer preview */
  onCancel?: () => void;
  /** Match bubble color scheme when rendered inside a sent message */
  isMine?: boolean;
  /** Clickable (jump to original) */
  onClick?: () => void;
}

const KIND_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
  file: FileIcon,
  contact: UserRound,
};

const KIND_LABEL: Record<string, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  file: 'File',
  contact: 'Contact',
};

/** Quoted reply preview. Used both in the composer and inside message bubbles. */
export default function ReplyPreview({ reply, onCancel, isMine, onClick }: Props) {
  const Icon = reply.attachmentKind ? KIND_ICON[reply.attachmentKind] || FileIcon : null;
  const preview = reply.content || (reply.attachmentKind ? KIND_LABEL[reply.attachmentKind] : '');

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 pl-2 pr-2 py-1.5 rounded-md border-l-[3px] ${
        isMine
          ? 'bg-primary-foreground/10 border-primary-foreground/60 text-primary-foreground'
          : 'bg-background/60 border-primary text-foreground'
      } ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
    >
      {!isMine && <Reply className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />}
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold truncate ${isMine ? 'text-primary-foreground' : 'text-primary'}`}>
          {reply.senderName}
        </p>
        <p className={`text-[12px] truncate flex items-center gap-1 ${isMine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {preview || <span className="italic opacity-70">Message</span>}
        </p>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="p-0.5 rounded hover:bg-accent shrink-0"
          aria-label="Cancel reply"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
