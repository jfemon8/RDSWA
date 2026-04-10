import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import {
  Reply, Smile, Forward, Star, Pin, Pencil, Trash2, EyeOff, Check, X, MoreVertical, Copy, ArrowRight,
} from 'lucide-react';
import ChatAttachmentView, { type ChatAttachmentData } from './ChatAttachmentView';
import ReactionBar from './ReactionBar';
import ReactionPicker from './ReactionPicker';
import MessageContextMenu, { type ContextMenuAction } from './MessageContextMenu';
import ReplyPreview, { type ReplyData } from './ReplyPreview';
import ReadReceipt from './ReadReceipt';
import { formatTime } from '@/lib/date';

/** Time windows mirroring the server. Keep in sync with communication.routes.ts. */
export const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const DELETE_EVERYONE_WINDOW_MS = 12 * 60 * 60 * 1000;
export const DELETE_FOR_ME_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ChatMessage {
  _id: string;
  sender: { _id: string; name?: string; avatar?: string } | string;
  content: string;
  attachments?: ChatAttachmentData[];
  replyTo?: ReplyData;
  forwardedFrom?: string;
  reactions?: Array<{ user: any; emoji: string }>;
  starredBy?: string[];
  pinnedAt?: string;
  pinnedBy?: any;
  readBy?: Array<{ user: string; readAt: string }>;
  isEdited?: boolean;
  createdAt: string;
}

export interface MessageBubbleProps {
  msg: ChatMessage;
  /** Hide sender name + avatar (used inside groups for consecutive messages from same sender). */
  groupedWithPrevious?: boolean;
  /** True for the current user's own messages — controls bubble color and alignment. */
  isMine: boolean;
  /** True when this is a group conversation (controls receipt + sender-name display). */
  isGroup: boolean;
  /** Current user id, for reaction-mine detection */
  currentUserId?: string;
  /** Admin override grants extended edit/delete powers */
  isAdmin?: boolean;
  /** Can the user pin messages here? Group admin / creator. */
  canPin?: boolean;
  /** Read-receipt: at least one other participant has seen this. */
  isRead?: boolean;
  /** Long-press / context menu actions */
  onReply: (msg: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (msg: ChatMessage) => void;
  onStar: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDeleteEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  /** Click on an embedded image — opens lightbox */
  onImageClick?: (url: string, name?: string) => void;
  /** Click the reply preview to scroll to the original */
  onJumpToMessage?: (messageId: string) => void;
  /** When the bubble is currently being edited */
  editingId: string | null;
  editContent: string;
  setEditContent: (s: string) => void;
  setEditingId: (id: string | null) => void;
  onSubmitEdit: (messageId: string, content: string) => void;
}

function isWithinMs(windowMs: number, sentAt: string | Date): boolean {
  const t = typeof sentAt === 'string' ? new Date(sentAt).getTime() : sentAt.getTime();
  return Date.now() - t <= windowMs;
}

/**
 * Single chat message row. Handles all interaction surfaces:
 *  - Hover quick actions (reply, react, more)
 *  - Right-click / long-press → context menu
 *  - Reaction picker popover
 *  - Inline edit
 *  - Reactions, reply quote, forwarded label, edited indicator, ticks
 */
export default function MessageBubble(props: MessageBubbleProps) {
  const {
    msg, groupedWithPrevious, isMine, isGroup, currentUserId, isAdmin, canPin, isRead,
    onReply, onReact, onForward, onStar, onPin, onEdit, onDeleteEveryone, onDeleteForMe,
    onImageClick, onJumpToMessage,
    editingId, editContent, setEditContent, setEditingId, onSubmitEdit,
  } = props;

  const senderObj = typeof msg.sender === 'object' ? msg.sender : null;
  const senderId = senderObj?._id || (typeof msg.sender === 'string' ? msg.sender : '');
  const senderName = senderObj?.name || 'Unknown';

  const [showPicker, setShowPicker] = useState(false);
  const [contextAnchor, setContextAnchor] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit = isMine && isWithinMs(EDIT_WINDOW_MS, msg.createdAt);
  const canDeleteEveryone = (isMine && isWithinMs(DELETE_EVERYONE_WINDOW_MS, msg.createdAt)) || !!isAdmin;
  const canDeleteForMe = isWithinMs(DELETE_FOR_ME_WINDOW_MS, msg.createdAt);
  const isStarred = !!currentUserId && msg.starredBy?.includes(currentUserId);
  const isPinned = !!msg.pinnedAt;
  const isEditing = editingId === msg._id;

  const openContext = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = (e as React.MouseEvent).clientX !== undefined
      ? { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
      : { x: 100, y: 100 };
    setContextAnchor(target);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setContextAnchor({ x: touch.clientX, y: touch.clientY });
    }, 450);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handleCopy = () => {
    if (msg.content) navigator.clipboard.writeText(msg.content).catch(() => { /* ignore */ });
  };

  const contextActions: ContextMenuAction[] = [
    { icon: Reply, label: 'Reply', onClick: () => onReply(msg) },
    { icon: Smile, label: 'React', onClick: () => setShowPicker(true) },
    { icon: Forward, label: 'Forward', onClick: () => onForward(msg) },
    { icon: Star, label: isStarred ? 'Unstar' : 'Star', onClick: () => onStar(msg._id) },
    { icon: Pin, label: isPinned ? 'Unpin' : 'Pin', onClick: () => onPin?.(msg._id), hidden: !canPin || !onPin },
    { icon: Copy, label: 'Copy text', onClick: handleCopy, hidden: !msg.content },
    { icon: Pencil, label: 'Edit', onClick: () => onEdit(msg), hidden: !canEdit },
    { icon: Trash2, label: 'Delete for everyone', onClick: () => onDeleteEveryone(msg._id), destructive: true, hidden: !canDeleteEveryone },
    { icon: EyeOff, label: 'Delete for me', onClick: () => onDeleteForMe(msg._id), destructive: true, hidden: !canDeleteForMe },
  ];

  return (
    <div
      id={`msg-${msg._id}`}
      className={`group relative flex ${isMine ? 'justify-end' : 'justify-start'} ${groupedWithPrevious ? 'mt-0.5' : 'mt-3'}`}
      onContextMenu={(e) => { e.preventDefault(); openContext(e); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${isMine ? 'flex-row-reverse' : ''}`}>
        {/* Avatar (only for received messages, only on the first of a group) */}
        {!isMine && isGroup && !groupedWithPrevious && (
          <Link to={`/members/${senderId}`} className="shrink-0">
            {senderObj?.avatar ? (
              <img src={senderObj.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {senderName[0]}
              </div>
            )}
          </Link>
        )}
        {!isMine && isGroup && groupedWithPrevious && <div className="w-8 shrink-0" />}

        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} min-w-0`}>
          {/* Sender name (group only, first of group) */}
          {!isMine && isGroup && !groupedWithPrevious && (
            <Link to={`/members/${senderId}`} className="text-[11px] font-medium text-primary mb-0.5 ml-1 hover:underline">
              {senderName}
            </Link>
          )}

          {/* Reaction picker pops above the bubble */}
          <AnimatePresence>
            {showPicker && (
              <div className="mb-1">
                <ReactionPicker
                  align={isMine ? 'end' : 'start'}
                  onPick={(emoji) => { onReact(msg._id, emoji); setShowPicker(false); }}
                />
              </div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1">
            {/* Hover-only quick action toolbar (sender side first) */}
            {isMine && !isEditing && (
              <QuickActions
                isMine
                onReply={() => onReply(msg)}
                onPicker={() => setShowPicker((v) => !v)}
                onMore={(e) => openContext(e)}
              />
            )}

            {isEditing ? (
              <InlineEditor
                value={editContent}
                onChange={setEditContent}
                onCancel={() => { setEditingId(null); setEditContent(''); }}
                onSubmit={() => onSubmitEdit(msg._id, editContent)}
              />
            ) : (
              <div
                className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                } ${isPinned ? 'ring-1 ring-amber-400/40' : ''}`}
              >
                {/* Forwarded label */}
                {msg.forwardedFrom && (
                  <div className={`flex items-center gap-1 text-[10px] italic mb-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    <ArrowRight className="h-3 w-3" /> Forwarded
                  </div>
                )}
                {/* Reply quote */}
                {msg.replyTo && (
                  <div className="mb-2">
                    <ReplyPreview
                      reply={msg.replyTo}
                      isMine={isMine}
                      onClick={msg.replyTo.messageId ? () => onJumpToMessage?.(msg.replyTo!.messageId!) : undefined}
                    />
                  </div>
                )}
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`space-y-2 ${msg.content ? 'mb-2' : ''}`}>
                    {msg.attachments.map((att, ai) => (
                      <ChatAttachmentView
                        key={ai}
                        attachment={att}
                        isMine={isMine}
                        onImageClick={onImageClick}
                      />
                    ))}
                  </div>
                )}
                {/* Text */}
                {msg.content && (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                {/* Meta row */}
                <div className={`flex items-center gap-1 text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
                  {isPinned && <Pin className="h-3 w-3" />}
                  {isStarred && <Star className="h-3 w-3 fill-current" />}
                  <span>{formatTime(msg.createdAt)}</span>
                  {msg.isEdited && <span className="italic">· edited</span>}
                  {isMine && <ReadReceipt sent read={!!isRead} />}
                </div>
              </div>
            )}

            {!isMine && !isEditing && (
              <QuickActions
                onReply={() => onReply(msg)}
                onPicker={() => setShowPicker((v) => !v)}
                onMore={(e) => openContext(e)}
              />
            )}
          </div>

          <ReactionBar
            reactions={(msg.reactions || []) as any}
            currentUserId={currentUserId}
            onToggle={(emoji) => onReact(msg._id, emoji)}
            align={isMine ? 'end' : 'start'}
          />
        </div>
      </div>

      <AnimatePresence>
        {contextAnchor && (
          <MessageContextMenu
            anchor={contextAnchor}
            actions={contextActions}
            onClose={() => setContextAnchor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickActions({
  onReply, onPicker, onMore, isMine,
}: {
  onReply: () => void;
  onPicker: () => void;
  onMore: (e: React.MouseEvent) => void;
  isMine?: boolean;
}) {
  return (
    <div
      className={`flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${
        isMine ? 'order-first' : ''
      }`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPicker(); }}
        className="p-1 rounded hover:bg-accent text-muted-foreground"
        title="Add reaction"
      >
        <Smile className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReply(); }}
        className="p-1 rounded hover:bg-accent text-muted-foreground"
        title="Reply"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMore(e); }}
        className="p-1 rounded hover:bg-accent text-muted-foreground"
        title="More"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InlineEditor({
  value, onChange, onCancel, onSubmit,
}: {
  value: string;
  onChange: (s: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onSubmit(); }
          if (e.key === 'Escape') onCancel();
        }}
        className="px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="button"
        onClick={onSubmit}
        className="p-1 rounded hover:bg-accent"
        aria-label="Save"
      >
        <Check className="h-3.5 w-3.5 text-green-500" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded hover:bg-accent"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
