import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChatSkeleton, InlineListSkeleton } from '@/components/ui/Skeleton';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useDMSocket, useTypingState, usePresence } from '@/hooks/useSocket';
import { useBackNavigation } from '@/hooks/useBackNavigation';
import {
  Search, ArrowLeft,
  User as UserIcon, X, MoreVertical, Star, Trash2, UserCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import MessageList from '@/components/chat/MessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import ForwardModal from '@/components/chat/ForwardModal';
import PresenceBadge, { formatLastSeen } from '@/components/chat/PresenceBadge';
import type { ChatMessage } from '@/components/chat/MessageBubble';
import type { ChatAttachment } from '@/components/chat/ChatAttachmentMenu';
import type { ReplyData } from '@/components/chat/ReplyPreview';

interface Partner {
  _id: string;
  name: string;
  avatar?: string;
}

export default function MessagesPage() {
  const location = useLocation();
  // The hub passes the partner along, which lets the thread render on the first paint.
  const passedPartner = (location.state as { partner?: Partner } | null)?.partner;
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get('with');
  const [selectedUser, setSelectedUser] = useState<Partner | null>(
    passedPartner && passedPartner._id === withUserId ? passedPartner : null
  );

  // Only look the partner up when they were not handed over, e.g. on a deep link or a page reload.
  useEffect(() => {
    if (!withUserId || selectedUser?._id === withUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/users/${withUserId}`);
        const u = data?.data;
        if (!cancelled && u) {
          setSelectedUser({ _id: u._id, name: u.name, avatar: u.avatar });
        }
      } catch {
        /* silent — the hub link below is the way out */
      }
    })();
    return () => { cancelled = true; };
  }, [withUserId, selectedUser?._id]);

  // Going back pops this thread off the stack, so it returns to whatever opened it and cannot be re-entered.
  const goBack = useBackNavigation('/dashboard/chat');
  const handleBack = () => {
    setSelectedUser(null);
    goBack();
  };

  // This route only ever opens one thread; the hub is the list, so a bare visit belongs there.
  if (!withUserId) return <Navigate to="/dashboard/chat" replace />;

  // Nothing is rendered while the partner resolves, since showing another screen first would
  // flash a page the reader never asked for.
  if (!selectedUser) return <ChatSkeleton />;

  return <ChatView partner={selectedUser} onBack={handleBack} />;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // The DM fetch marks messages read server-side, so refresh the badges immediately rather than awaiting the next poll.
  useEffect(() => {
    if (!data) return;
    queryClient.invalidateQueries({ queryKey: ['message-unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
  }, [data, queryClient]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: () => api.post(`/communication/dm/${partner._id}/clear`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm', partner._id] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['message-unread-count'] });
      toast.success('Chat cleared');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to clear chat'),
  });

  // Close the header menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleClearChat = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Clear chat?',
      message: `All messages with ${partner.name} will be hidden in your view. ${partner.name} will still see them.`,
      confirmLabel: 'Clear chat',
      variant: 'danger',
    });
    if (ok) clearChatMutation.mutate();
  };

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
    // Negative margins cancel the layout padding for an edge-to-edge chat, with calc() widths restoring the inner width.
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
        <Link
          to={`/members/${partner._id}`}
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 rounded-md hover:bg-accent/40 transition-colors px-1 -mx-1 py-1"
          title={`View ${partner.name}'s profile`}
        >
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
        </Link>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          title="Search"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="tap-target flex items-center justify-center rounded-md hover:bg-accent"
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                role="menu"
                className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-md shadow-xl py-1 z-50"
              >
                <Link
                  to={`/members/${partner._id}`}
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  View profile
                </Link>
                <Link
                  to="/dashboard/starred"
                  onClick={() => setMenuOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Star className="h-4 w-4 text-muted-foreground" />
                  Starred messages
                </Link>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={clearChatMutation.isPending}
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear chat
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
                    <InlineListSkeleton count={2} />
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

