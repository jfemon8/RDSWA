import { Link } from 'react-router-dom';
import { FileText, File as FileIcon, Download, Image as ImageIcon, Music, Video as VideoIcon, UserRound, Phone, Mail, AlertCircle } from 'lucide-react';

export interface ChatAttachmentData {
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'file' | 'contact';
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  expired?: boolean;
  contact?: {
    userId?: string;
    name: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
}

interface Props {
  attachment: ChatAttachmentData;
  /** True when rendered inside the sender's own (primary-colored) bubble. */
  isMine?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Labels the thumbnail shows when media has been purged from storage. */
const EXPIRED_LABEL: Record<string, string> = {
  image: 'Image expired',
  video: 'Video expired',
  audio: 'Audio expired',
  pdf: 'PDF expired',
  file: 'File expired',
};

/**
 * Renders a single chat attachment. Handles media (image/video/audio/pdf/file),
 * the expired placeholder, and contact cards.
 *
 * The visual scope is intentionally tight — this is meant to live INSIDE a
 * chat bubble (max-w-sm), not as a page-level element.
 */
export default function ChatAttachmentView({ attachment, isMine }: Props) {
  const { kind, url, expired } = attachment;

  if (kind === 'contact') {
    return <ContactCard attachment={attachment} isMine={isMine} />;
  }

  if (expired || !url) {
    return <ExpiredPlaceholder kind={kind} name={attachment.name} isMine={isMine} />;
  }

  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name || 'Image attachment'}
          loading="lazy"
          className="max-w-full max-h-64 rounded-lg object-cover"
        />
      </a>
    );
  }

  if (kind === 'video') {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-w-full max-h-64 rounded-lg bg-black"
      >
        Your browser does not support video playback.
      </video>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="w-full min-w-[220px]">
        <audio src={url} controls preload="metadata" className="w-full" />
        {attachment.name && (
          <p className={`text-[10px] mt-1 truncate ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {attachment.name}
          </p>
        )}
      </div>
    );
  }

  // pdf / file
  return <FileCard attachment={attachment} isMine={isMine} />;
}

function FileCard({ attachment, isMine }: Props) {
  const isPdf = attachment.kind === 'pdf';
  const Icon = isPdf ? FileText : FileIcon;
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 min-w-[220px] max-w-sm px-3 py-2.5 rounded-lg transition-colors ${
        isMine
          ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground'
          : 'bg-background hover:bg-accent text-foreground border'
      }`}
    >
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-primary-foreground/20' : 'bg-primary/10'}`}>
        <Icon className={`h-5 w-5 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{attachment.name || 'Attachment'}</p>
        <p className={`text-[11px] truncate ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatBytes(attachment.size)}
        </p>
      </div>
      <Download className={`h-4 w-4 shrink-0 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
    </a>
  );
}

function ContactCard({ attachment, isMine }: Props) {
  const c = attachment.contact;
  if (!c) return null;
  const inner = (
    <div
      className={`flex items-center gap-3 min-w-[220px] max-w-sm px-3 py-2.5 rounded-lg transition-colors ${
        isMine
          ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground'
          : 'bg-background hover:bg-accent text-foreground border'
      }`}
    >
      {c.avatar ? (
        <img src={c.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isMine ? 'bg-primary-foreground/20' : 'bg-primary/10'}`}>
          <UserRound className={`h-4 w-4 ${isMine ? 'text-primary-foreground' : 'text-primary'}`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{c.name}</p>
        <div className={`flex items-center gap-2 text-[11px] ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {c.phone && (
            <span className="flex items-center gap-1 truncate">
              <Phone className="h-3 w-3 shrink-0" /> {c.phone}
            </span>
          )}
          {c.email && !c.phone && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" /> {c.email}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // If we have a userId, link to their profile so the recipient can open it directly.
  if (c.userId) {
    return (
      <Link to={`/members/${c.userId}`} onClick={(e) => e.stopPropagation()}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function ExpiredPlaceholder({
  kind,
  name,
  isMine,
}: {
  kind: ChatAttachmentData['kind'];
  name?: string;
  isMine?: boolean;
}) {
  const Icon =
    kind === 'image' ? ImageIcon :
    kind === 'video' ? VideoIcon :
    kind === 'audio' ? Music :
    kind === 'pdf' ? FileText :
    FileIcon;
  return (
    <div
      className={`flex items-center gap-3 min-w-[220px] max-w-sm px-3 py-2.5 rounded-lg border-dashed border ${
        isMine
          ? 'bg-primary-foreground/5 border-primary-foreground/30 text-primary-foreground/80'
          : 'bg-muted/50 border-muted-foreground/30 text-muted-foreground'
      }`}
    >
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-primary-foreground/10' : 'bg-muted'}`}>
        <Icon className="h-5 w-5 opacity-70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {EXPIRED_LABEL[kind] || 'Attachment expired'}
        </p>
        {name && <p className="text-[11px] truncate opacity-70">{name}</p>}
      </div>
    </div>
  );
}
