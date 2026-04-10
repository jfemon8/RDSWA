import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useDMSocket, useTypingState, usePresence } from '@/hooks/useSocket';
import {
  MessagesSquare, Send, Loader2, Search, ArrowLeft,
  User as UserIcon, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDateCustom } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import MessageList from '@/components/chat/MessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import ForwardModal from '@/components/chat/ForwardModal';
import PresenceBadge, { formatLastSeen } from '@/components/chat/PresenceBadge';
import type { ChatMessage } from '@/components/chat/MessageBubble';
import type { ChatAttachment } from '@/components/chat/ChatAttachmentMenu';
import type { ReplyData } from '@/components/chat/ReplyPreview';

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

// ── Conversation list ────────────────────────────────────────────────

function ConversationList({
  onSelect,
}: {
  onSelect: (user: { _id: string; name: string; avatar?: string }) => void;
}) {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  useDMSocket(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: async () => {
      const { data } = await api.get('/communication/dm');
      return data.data;
    },
  });

  const conversations = data || [];

  const partnerIds = useMemo(
    () => conversations.map((c: any) => c.user?._id).filter(Boolean),
    [conversations]
  );
  const { online } = usePresence(partnerIds);

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
          {conversations.map((conv: any, i: number) => {
            const isOnline = conv.user && online.has(conv.user._id);
            return (
              <FadeIn key={conv.user?._id || i} delay={i * 0.03} direction="up" distance={12}>
                <button
                  onClick={() => conv.user && onSelect(conv.user)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card text-left hover:bg-accent transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar src={conv.user?.avatar} name={conv.user?.name} />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0">
                        <PresenceBadge online size={10} />
                      </span>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DM Chat view ─────────────────────────────────────────────────────

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyData | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useDMSocket(partner._id);
  const { online, lastSeen } = usePresence([partner._id]);
  const isOnline = online.has(partner._id);
  const partnerLastSeen = lastSeen.get(partner._id);

  const { typing: typingIds, emitTyping } = useTypingState({ partnerId: partner._id });
  const typingNames = typingIds.has(partner._id) ? [partner.name] : [];

  const { data, isLoading } = useQuery({
    queryKey: ['dm', partner._id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/dm/${partner._id}?limit=50`);
      return data;
    },
  });

  const messages: ChatMessage[] = useMemo(() => data?.data || [], [data?.data]);

  const readMessageIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      if (senderId === user?._id && (msg as any).isRead) {
        set.add(msg._id);
      }
    }
    return set;
  }, [messages, user?._id]);

  // ── Mutations ─────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: (body: { content: string; attachments: ChatAttachment[]; replyToId?: string }) =>
      api.post(`/communication/dm/${partner._id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send'),
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/communication/dm/messages/${messageId}`, { content }),
    onSuccess: () => {
      setEditingId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to edit'),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/communication/dm/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      toast.success('Deleted for everyone');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  const deleteForMeMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/communication/dm/messages/${messageId}/me`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      toast.success('Hidden for you');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.post(`/communication/dm/messages/${messageId}/react`, { emoji }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dm', partner._id] }),
  });

  const starMutation = useMutation({
    mutationFn: (messageId: string) => api.post(`/communication/messages/${messageId}/star`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dm', partner._id] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (messageIds: string[]) =>
      api.post('/communication/dm/messages/read', { messageIds, partnerId: partner._id }),
  });

  const { data: searchMessages, isLoading: searchLoading } = useQuery({
    queryKey: ['dm-search', partner._id, searchQuery],
    queryFn: async () => {
      const { data } = await api.get(`/communication/dm/${partner._id}/search?q=${encodeURIComponent(searchQuery)}`);
      return data.data;
    },
    enabled: showSearch && searchQuery.length >= 2,
  });

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSend = useCallback(async (
    content: string,
    attachments: ChatAttachment[],
    replyToId?: string,
  ) => {
    await sendMutation.mutateAsync({ content, attachments, replyToId });
    setReplyTo(null);
  }, [sendMutation]);

  const handleDeleteEveryone = async (messageId: string) => {
    const ok = await confirm({
      title: 'Delete for everyone?',
      message: 'This message will be permanently removed for both participants.',
      confirmLabel: 'Delete for everyone',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(messageId);
  };

  const handleDeleteForMe = async (messageId: string) => {
    const ok = await confirm({
      title: 'Delete for me?',
      message: 'This message will be hidden in your view only.',
      confirmLabel: 'Hide for me',
      variant: 'danger',
    });
    if (ok) deleteForMeMutation.mutate(messageId);
  };

  const handleReply = (msg: ChatMessage) => {
    const senderObj = typeof msg.sender === 'object' ? msg.sender : null;
    setReplyTo({
      messageId: msg._id,
      senderId: senderObj?._id,
      senderName: senderObj?._id === user?._id ? 'You' : (senderObj?.name || partner.name),
      content: msg.content,
      attachmentKind: msg.attachments?.[0]?.kind as any,
    });
  };

  const handleEdit = (msg: ChatMessage) => {
    setEditingId(msg._id);
    setEditContent(msg.content);
  };

  const handleJumpTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary', 'rounded-2xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'rounded-2xl'), 1400);
    }
  };

  const handleVisibleMessages = useCallback((messageIds: string[]) => {
    const toMark = messageIds.filter((mid) => {
      const msg = messages.find((m) => m._id === mid);
      if (!msg) return false;
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      return senderId !== user?._id && !(msg as any).isRead;
    });
    if (toMark.length > 0) markReadMutation.mutate(toMark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user?._id]);

  return (
    // Negative margins cancel the DashboardLayout main padding so DM chat
    // goes edge-to-edge. calc() widths restore the inner layout width so
    // children fill the visual area (not just the original content box).
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-3 sm:-m-4 lg:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 border-b bg-card shrink-0">
        <button
          onClick={onBack}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative shrink-0">
          <Avatar src={partner.avatar} name={partner.name} />
          {isOnline && (
            <span className="absolute bottom-0 right-0">
              <PresenceBadge online size={10} />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{partner.name}</h2>
          <p className="text-[11px] text-muted-foreground truncate">
            {typingNames.length > 0
              ? 'typing…'
              : isOnline
                ? 'Online'
                : formatLastSeen(partnerLastSeen)}
          </p>
        </div>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          title="Search"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b bg-card overflow-hidden"
          >
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages…"
                  className="w-full pl-9 pr-9 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {searchQuery.length >= 2 && (
                <div className="max-h-64 overflow-y-auto mt-2">
                  {searchLoading ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (searchMessages || []).length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-3">No matches</p>
                  ) : (
                    <ul className="space-y-1">
                      {searchMessages.map((m: any) => (
                        <li key={m._id}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSearch(false);
                              setSearchQuery('');
                              handleJumpTo(m._id);
                            }}
                            className="w-full text-left p-2 rounded hover:bg-accent"
                          >
                            <p className="text-xs font-medium truncate">{m.sender?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.content}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        isGroup={false}
        currentUserId={user?._id}
        readMessageIds={readMessageIds}
        typingNames={typingNames}
        onReply={handleReply}
        onReact={(messageId, emoji) => reactMutation.mutate({ messageId, emoji })}
        onForward={(msg) => setForwardTarget(msg)}
        onStar={(messageId) => starMutation.mutate(messageId)}
        onEdit={handleEdit}
        onDeleteEveryone={handleDeleteEveryone}
        onDeleteForMe={handleDeleteForMe}
        onVisibleMessages={handleVisibleMessages}
        editingId={editingId}
        editContent={editContent}
        setEditContent={setEditContent}
        setEditingId={setEditingId}
        onSubmitEdit={(mid, content) => editMutation.mutate({ messageId: mid, content })}
      />

      <ChatComposer
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={emitTyping}
      />

      <AnimatePresence>
        {forwardTarget && (
          <ForwardModal
            messageId={forwardTarget._id}
            onClose={() => setForwardTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

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
