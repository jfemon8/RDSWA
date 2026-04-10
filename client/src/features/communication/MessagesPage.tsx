import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useDMSocket } from '@/hooks/useSocket';
import {
  MessagesSquare, Send, Loader2, Search, ArrowLeft,
  User as UserIcon, X, Pencil, Trash2, EyeOff, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { formatTime, formatDateCustom } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import ChatAttachmentMenu, { type ChatAttachment } from '@/components/chat/ChatAttachmentMenu';
import ChatAttachmentView from '@/components/chat/ChatAttachmentView';

/** Time windows mirroring the server. Keep in sync with communication.routes.ts. */
const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000;
const DELETE_EVERYONE_WINDOW_MS = 12 * 60 * 60 * 1000;
const DELETE_FOR_ME_WINDOW_MS = 24 * 60 * 60 * 1000;
function isWithinMs(windowMs: number, sentAt: string | Date): boolean {
  const t = typeof sentAt === 'string' ? new Date(sentAt).getTime() : sentAt.getTime();
  return Date.now() - t <= windowMs;
}

export default function MessagesPage() {
  const [selectedUser, setSelectedUser] = useState<{ _id: string; name: string; avatar?: string } | null>(null);

  return (
    <div>
      <AnimatePresence mode="wait">
        {selectedUser ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ChatView
              partner={selectedUser}
              onBack={() => setSelectedUser(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <ConversationList onSelect={setSelectedUser} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConversationList({
  onSelect,
}: {
  onSelect: (user: { _id: string; name: string; avatar?: string }) => void;
}) {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // Listen for new DMs
  useDMSocket(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: async () => {
      const { data } = await api.get('/communication/dm');
      return data.data;
    },
  });

  const conversations = data || [];

  // Search members for new chat
  const { data: searchResults } = useQuery({
    queryKey: ['member-search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(search)}&limit=10`);
      return data.data;
    },
    enabled: showNewChat && search.length >= 2,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <BlurText text="Messages" className="text-2xl sm:text-3xl font-bold" delay={50} />
        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Send className="h-4 w-4" /> New Chat
        </button>
      </div>

      {/* New chat search */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Start a conversation</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
              </div>
              {searchResults && searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((u: any) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        onSelect({ _id: u._id, name: u.name, avatar: u.avatar });
                        setShowNewChat(false);
                        setSearch('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-accent transition-colors"
                    >
                      <Avatar src={u.avatar} name={u.name} />
                      <span className="text-sm">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-12">
            <MessagesSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No messages yet. Start a conversation!</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv: any, i: number) => (
            <FadeIn key={conv.user?._id || i} delay={i * 0.03} direction="up" distance={12}>
              <button
                onClick={() => conv.user && onSelect(conv.user)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left hover:bg-accent transition-colors"
              >
                <Avatar src={conv.user?.avatar} name={conv.user?.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{conv.user?.name || 'Unknown'}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatTimeAgo(conv.lastMessage?.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.lastMessage?.content || lastMessagePreview(conv.lastMessage)}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shrink-0"
                  >
                    {conv.unreadCount}
                  </motion.span>
                )}
              </button>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatView({
  partner,
  onBack,
}: {
  partner: { _id: string; name: string; avatar?: string };
  onBack: () => void;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Real-time DMs
  useDMSocket(partner._id);

  const { data, isLoading } = useQuery({
    queryKey: ['dm', partner._id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/dm/${partner._id}?limit=50`);
      return data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/communication/dm/${partner._id}`, {
      content: message,
      attachments: pendingAttachments,
    }),
    onSuccess: () => {
      setMessage('');
      setPendingAttachments([]);
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        toast.error(Object.values(fieldErrors)[0]);
      } else {
        toast.error(err?.response?.data?.message || 'Failed to send message');
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/communication/dm/messages/${messageId}`, { content }),
    onSuccess: () => {
      setEditingId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to edit message');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/communication/dm/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      toast.success('Message deleted for everyone');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete message');
    },
  });

  const deleteForMeMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/communication/dm/messages/${messageId}/me`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      toast.success('Message hidden for you');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to hide message');
    },
  });

  const handleDelete = async (messageId: string) => {
    const ok = await confirm({
      title: 'Delete for everyone?',
      message: 'This message will be permanently removed for both participants. Any attached files will also be deleted from storage.',
      confirmLabel: 'Delete for everyone',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(messageId);
  };

  const handleDeleteForMe = async (messageId: string) => {
    const ok = await confirm({
      title: 'Delete for me?',
      message: 'This message will be hidden in your view only. The other person will still see it.',
      confirmLabel: 'Hide for me',
      variant: 'danger',
    });
    if (ok) deleteForMeMutation.mutate(messageId);
  };

  const messages = data?.data || [];
  const canSend = (message.trim().length > 0 || pendingAttachments.length > 0) && !sendMutation.isPending;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b">
        <button
          onClick={onBack}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar src={partner.avatar} name={partner.name} />
        <span className="font-medium truncate">{partner.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth-touch py-4 space-y-3 px-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg: any, i: number) => {
            const isMine = msg.sender?._id === user?._id;
            const canEdit = isMine && isWithinMs(EDIT_WINDOW_MS, msg.createdAt);
            const canDeleteForEveryone = isMine && isWithinMs(DELETE_EVERYONE_WINDOW_MS, msg.createdAt);
            const canDeleteForMe = isWithinMs(DELETE_FOR_ME_WINDOW_MS, msg.createdAt);
            const hasAnyAction = canEdit || canDeleteForEveryone || canDeleteForMe;

            const actionButtons = (
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => { setEditingId(msg._id); setEditContent(msg.content); }}
                    className="p-1 rounded hover:bg-accent"
                    title="Edit (within 6h)"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {canDeleteForEveryone && (
                  <button
                    onClick={() => handleDelete(msg._id)}
                    className="p-1 rounded hover:bg-accent"
                    title="Delete for everyone (within 12h)"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
                {canDeleteForMe && (
                  <button
                    onClick={() => handleDeleteForMe(msg._id)}
                    className="p-1 rounded hover:bg-accent"
                    title="Delete for me (within 24h)"
                  >
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            );

            return (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
              >
                <div className={`flex items-end gap-1 max-w-[85%] sm:max-w-[75%]`}>
                  {isMine && hasAnyAction && editingId !== msg._id && actionButtons}
                  {editingId === msg._id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editContent.trim()) editMutation.mutate({ messageId: msg._id, content: editContent });
                          }
                          if (e.key === 'Escape') { setEditingId(null); setEditContent(''); }
                        }}
                      />
                      <button
                        onClick={() => { if (editContent.trim()) editMutation.mutate({ messageId: msg._id, content: editContent }); }}
                        className="p-1 rounded hover:bg-accent"
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      </button>
                      <button onClick={() => { setEditingId(null); setEditContent(''); }} className="p-1 rounded hover:bg-accent">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      }`}
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`space-y-2 ${msg.content ? 'mb-2' : ''}`}>
                          {msg.attachments.map((att: any, ai: number) => (
                            <ChatAttachmentView key={ai} attachment={att} isMine={isMine} />
                          ))}
                        </div>
                      )}
                      {msg.content && (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatTime(msg.createdAt)}{msg.isEdited && <span className="ml-1 italic">· edited</span>}
                      </p>
                    </div>
                  )}
                  {!isMine && hasAnyAction && editingId !== msg._id && actionButtons}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          if (!canSend) { setErrors({ message: 'Message cannot be empty' }); return; }
          sendMutation.mutate();
        }}
        noValidate
        className="pt-3 border-t"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingAttachments.map((att, i) => (
              <div
                key={i}
                className="relative flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs max-w-[220px]"
              >
                <span className="truncate">
                  {att.kind === 'contact' ? `Contact: ${att.contact?.name}` : (att.name || att.kind)}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-0.5 rounded hover:bg-accent shrink-0"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <ChatAttachmentMenu
            onSelect={(att) => setPendingAttachments((prev) => [...prev, att])}
            disabled={sendMutation.isPending}
          />
          <div className="flex-1 min-w-0">
            <textarea
              placeholder="Type a message..."
              value={message}
              onChange={(e) => { setMessage(e.target.value); setErrors((prev) => { const { message, ...rest } = prev; return rest; }); }}
              onKeyDown={handleKeyDown}
              rows={1}
              className={`w-full px-4 py-2.5 border rounded-full bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.message ? 'border-red-500' : ''}`}
            />
            <FieldError message={errors.message} />
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="h-11 w-11 shrink-0 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 transition-colors"
            aria-label="Send message"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Avatar({ src, name }: { src?: string; name?: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {src ? (
        <img src={src} alt={name || ''} className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

/** Preview label for an attachment-only last message in the conversation list. */
function lastMessagePreview(msg?: { attachments?: Array<{ kind: string; name?: string; contact?: { name?: string } }> }): string {
  const att = msg?.attachments?.[0];
  if (!att) return '';
  switch (att.kind) {
    case 'image': return '📷 Image';
    case 'video': return '🎬 Video';
    case 'audio': return '🎵 Audio';
    case 'pdf': return '📄 PDF';
    case 'file': return `📎 ${att.name || 'File'}`;
    case 'contact': return `👤 ${att.contact?.name || 'Contact'}`;
    default: return 'Attachment';
  }
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDateCustom(dateStr, { month: 'short', day: 'numeric' });
}
