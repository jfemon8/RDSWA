import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatSocket, useTypingState, usePresence } from '@/hooks/useSocket';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import {
  ArrowLeft, Loader2, Users, User as UserIcon, Globe, Building2, Hash, X,
  UserPlus, UserMinus, Search, LogOut, Bell, BellOff, Pin, Trash2, UserCheck, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import MessageList from '@/components/chat/MessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import ForwardModal from '@/components/chat/ForwardModal';
import type { ChatMessage } from '@/components/chat/MessageBubble';
import type { ChatAttachment } from '@/components/chat/ChatAttachmentMenu';
import type { ReplyData } from '@/components/chat/ReplyPreview';
import Spinner from '@/components/ui/Spinner';

const TYPE_ICONS: Record<string, typeof Globe> = {
  central: Globe,
  department: Building2,
  custom: Hash,
};

export default function GroupChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [showMembers, setShowMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyData | null>(null);
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [showPinned, setShowPinned] = useState(false);

  const isAdmin = !!user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);

  useChatSocket(id);

  const { data, isLoading } = useQuery({
    queryKey: ['group', id, pagesLoaded],
    queryFn: async () => {
      const { data } = await api.get(`/communication/groups/${id}?limit=${50 * pagesLoaded}`);
      return data.data;
    },
    enabled: !!id,
  });

  const group = data?.group;
  const messages: ChatMessage[] = useMemo(() => data?.messages || [], [data?.messages]);
  const hasMore = !!data?.hasMore;

  const memberIds = useMemo(() => {
    return (group?.members || [])
      .map((m: any) => m._id || m)
      .filter((mid: string) => mid !== user?._id);
  }, [group?.members, user?._id]);

  const { online } = usePresence(memberIds);

  const { typing: typingIds, emitTyping } = useTypingState({ groupId: id });
  const typingNames = useMemo((): string[] => {
    const byId = new Map<string, string>();
    for (const m of (group?.members || []) as any[]) {
      if (m?._id) byId.set(String(m._id), String(m.name || 'Someone'));
    }
    return Array.from(typingIds)
      .filter((uid) => uid !== user?._id)
      .map((uid) => byId.get(uid) || 'Someone');
  }, [typingIds, group?.members, user?._id]);

  const readMessageIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages) {
      if ((msg as any).readBy?.some((r: any) =>
        (r.user?._id || r.user) !== user?._id,
      )) {
        set.add(msg._id);
      }
    }
    return set;
  }, [messages, user?._id]);

  const isCreator = !!group?.createdBy && (
    (typeof group.createdBy === 'string' ? group.createdBy : group.createdBy?._id) === user?._id
  );
  const canManageMembers = isAdmin || (group?.type === 'custom' && isCreator);
  const canPin = canManageMembers;
  const canLeave = group?.type === 'custom';

  // ── Mutations ─────────────────────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: (body: { content: string; attachments: ChatAttachment[]; replyToId?: string }) =>
      api.post(`/communication/groups/${id}/messages`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send message'),
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/communication/groups/${id}/messages/${messageId}`, { content }),
    onSuccess: () => {
      setEditingId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['group', id] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to edit'),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/communication/groups/${id}/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Deleted for everyone');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  const deleteForMeMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/communication/groups/${id}/messages/${messageId}/me`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Hidden for you');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.post(`/communication/groups/${id}/messages/${messageId}/react`, { emoji }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to react'),
  });

  const starMutation = useMutation({
    mutationFn: (messageId: string) => api.post(`/communication/messages/${messageId}/star`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group', id] }),
  });

  const pinMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.post(`/communication/groups/${id}/messages/${messageId}/pin`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      queryClient.invalidateQueries({ queryKey: ['group-pinned', id] });
      toast.success(res?.data?.message || 'Updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const muteMutation = useMutation({
    mutationFn: (mute: boolean) => api.patch(`/communication/groups/${id}/mute`, { mute }),
    onSuccess: (_res, mute) => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success(mute ? 'Notifications muted' : 'Notifications unmuted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const markReadMutation = useMutation({
    mutationFn: (messageIds: string[]) =>
      api.post(`/communication/groups/${id}/messages/read`, { messageIds }),
  });

  const leaveGroupMutation = useMutation({
    mutationFn: () => api.delete(`/communication/groups/${id}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('You left the group');
      navigate('/dashboard/groups');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to leave'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: () => api.delete(`/communication/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      toast.success('Group deleted');
      navigate('/dashboard/groups');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  // Join requests (custom groups — group admin or platform admin)
  const { data: joinRequests } = useQuery({
    queryKey: ['group-join-requests', id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/groups/${id}/join-requests`);
      return data.data;
    },
    enabled: !!id && canManageMembers && group?.type === 'custom',
    refetchInterval: 30_000,
  });

  const reviewJoinRequestMutation = useMutation({
    mutationFn: (vars: { requestId: string; status: 'approved' | 'rejected' }) =>
      api.patch(`/communication/groups/${id}/join-requests/${vars.requestId}`, { status: vars.status }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success(vars.status === 'approved' ? 'Request approved' : 'Request rejected');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to process request'),
  });

  // Member management ─────────────────────────────────────────────────────
  const { data: searchResults } = useQuery({
    queryKey: ['member-search', memberSearch],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(memberSearch)}&limit=10`);
      return data.data;
    },
    enabled: canManageMembers && showAddMember && memberSearch.length >= 2,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/communication/groups/${id}/members`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Member added');
      setMemberSearch('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/communication/groups/${id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      toast.success('Member removed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  // Pinned messages ─────────────────────────────────────────────────────
  const { data: pinnedMessages } = useQuery({
    queryKey: ['group-pinned', id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/groups/${id}/pinned`);
      return data.data;
    },
    enabled: !!id && showPinned,
  });

  // Search ─────────────────────────────────────────────────────
  const { data: searchMessages, isLoading: searchLoading } = useQuery({
    queryKey: ['group-search', id, searchQuery],
    queryFn: async () => {
      const { data } = await api.get(`/communication/groups/${id}/search?q=${encodeURIComponent(searchQuery)}`);
      return data.data;
    },
    enabled: !!id && showSearch && searchQuery.length >= 2,
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
      message: 'This message will be removed for all participants. Attached files will also be deleted from storage.',
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
      senderName: senderObj?.name || 'Unknown',
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
    // Only mark messages I haven't sent and haven't already read
    const toMark = messageIds.filter((mid) => {
      const msg = messages.find((m) => m._id === mid);
      if (!msg) return false;
      const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
      if (senderId === user?._id) return false;
      const alreadyRead = (msg as any).readBy?.some((r: any) =>
        (r.user?._id || r.user) === user?._id,
      );
      return !alreadyRead;
    });
    if (toMark.length > 0) markReadMutation.mutate(toMark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, user?._id]);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => { document.body.classList.remove('overflow-hidden'); };
  }, []);

  // ── Render ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Spinner size="md" />
    );
  }

  if (!group) {
    return <div className="text-center py-12 text-muted-foreground">Group not found</div>;
  }

  const TypeIcon = TYPE_ICONS[group.type] || Hash;
  const memberCount = group.members?.length || 0;

  return (
    // Negative margins cancel the DashboardLayout main padding (p-3 sm:p-4 lg:p-6)
    // so the chat container goes edge-to-edge. The matching calc() widths are
    // critical: without them, the chat's *computed* width would still be the
    // parent's content-box width (= main width − padding), so children would
    // lay out within the smaller box and leave empty space on the right even
    // though the background extends to the visual edges.
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-3 sm:-m-4 lg:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 border-b bg-card shrink-0">
        <button
          onClick={() => navigate('/dashboard/groups')}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {group.avatar ? (
            <img src={group.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <TypeIcon className="h-4 w-4 text-primary" />
          )}
        </div>
        <button
          onClick={() => setShowMembers(true)}
          className="flex-1 min-w-0 text-left"
        >
          <h2 className="font-semibold text-sm truncate">{group.name}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {typingNames.length > 0
              ? `${typingNames[0]}${typingNames.length > 1 ? ` +${typingNames.length - 1}` : ''} typing…`
              : `${memberCount} members`}
          </p>
        </button>

        <button
          onClick={() => setShowSearch((v) => !v)}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          title="Search"
          aria-label="Search messages"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowPinned((v) => !v)}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          title="Pinned messages"
          aria-label="Pinned messages"
        >
          <Pin className="h-5 w-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => muteMutation.mutate(!group.isMuted)}
          className="tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
          title={group.isMuted ? 'Unmute' : 'Mute'}
          aria-label={group.isMuted ? 'Unmute' : 'Mute'}
        >
          {group.isMuted ? (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {canLeave && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Leave Group',
                message: `Leave "${group.name}"?`,
                confirmLabel: 'Leave',
                variant: 'danger',
              });
              if (ok) leaveGroupMutation.mutate();
            }}
            disabled={leaveGroupMutation.isPending}
            className="tap-target flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 shrink-0"
            title="Leave"
            aria-label="Leave"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
        {/* Delete group — platform admin only (backend authorizes) */}
        {isAdmin && (
          <button
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete Group',
                message: `Delete "${group.name}"? All messages and members will be removed. This cannot be undone.`,
                confirmLabel: 'Delete group',
                variant: 'danger',
              });
              if (ok) deleteGroupMutation.mutate();
            }}
            disabled={deleteGroupMutation.isPending}
            className="tap-target flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 shrink-0"
            title="Delete group"
            aria-label="Delete group"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
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

      {/* Pinned panel */}
      <AnimatePresence>
        {showPinned && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b bg-amber-50/30 dark:bg-amber-900/10 overflow-hidden"
          >
            <div className="p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Pin className="h-3 w-3" /> Pinned messages
                </p>
                <button type="button" onClick={() => setShowPinned(false)} className="p-1 rounded hover:bg-accent">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {(!pinnedMessages || pinnedMessages.length === 0) ? (
                <p className="text-center text-xs text-muted-foreground py-3">No pinned messages</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {pinnedMessages.map((m: any) => (
                    <li key={m._id}>
                      <button
                        type="button"
                        onClick={() => { setShowPinned(false); handleJumpTo(m._id); }}
                        className="w-full text-left p-2 rounded hover:bg-accent"
                      >
                        <p className="text-xs font-medium truncate">{m.sender?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.content || '(Attachment)'}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages + Composer */}
        <div className="flex-1 flex flex-col min-w-0">
          <MessageList
            messages={messages}
            isGroup
            currentUserId={user?._id}
            isAdmin={isAdmin}
            canPin={canPin}
            typingNames={typingNames}
            readMessageIds={readMessageIds}
            onReply={handleReply}
            onReact={(messageId, emoji) => reactMutation.mutate({ messageId, emoji })}
            onForward={(msg) => setForwardTarget(msg)}
            onStar={(messageId) => starMutation.mutate(messageId)}
            onPin={(messageId) => pinMutation.mutate(messageId)}
            onEdit={handleEdit}
            onDeleteEveryone={handleDeleteEveryone}
            onDeleteForMe={handleDeleteForMe}
            onVisibleMessages={handleVisibleMessages}
            onLoadOlder={() => setPagesLoaded((p) => p + 1)}
            hasMore={hasMore}
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
        </div>

        {/* Members sidebar */}
        <AnimatePresence>
          {showMembers && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                onClick={() => setShowMembers(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                className="fixed lg:static top-0 right-0 z-50 h-full lg:h-auto w-[85vw] max-w-[300px] lg:w-72 border-l bg-card overflow-y-auto shrink-0"
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" /> Members ({memberCount})
                    </h3>
                    <div className="flex gap-1">
                      {canManageMembers && (
                        <button
                          onClick={() => setShowAddMember((v) => !v)}
                          className={`p-1.5 rounded hover:bg-accent ${showAddMember ? 'text-primary' : ''}`}
                          title="Add member"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => setShowMembers(false)} className="p-1.5 rounded hover:bg-accent">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Add member search */}
                  <AnimatePresence>
                    {canManageMembers && showAddMember && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 overflow-hidden"
                      >
                        <div className="relative mb-1.5">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search members..."
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="w-full pl-7 pr-2 py-1.5 border rounded-md bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                            autoFocus
                          />
                        </div>
                        {searchResults && searchResults.length > 0 && (
                          <div className="space-y-0.5 max-h-40 overflow-y-auto border rounded-md p-1 bg-background">
                            {searchResults
                              .filter((u: any) => !group.members?.some((m: any) => m._id === u._id))
                              .map((u: any) => (
                                <button
                                  key={u._id}
                                  onClick={() => addMemberMutation.mutate(u._id)}
                                  disabled={addMemberMutation.isPending}
                                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-accent text-xs disabled:opacity-50"
                                >
                                  {u.avatar ? (
                                    <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                      <UserIcon className="h-3 w-3" />
                                    </div>
                                  )}
                                  <span className="truncate flex-1">{u.name}</span>
                                  <UserPlus className="h-3 w-3 text-primary" />
                                </button>
                              ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pending join requests — for group admins on custom groups */}
                  {canManageMembers && group.type === 'custom' && (joinRequests || []).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pending join requests ({joinRequests.length})
                      </p>
                      <div className="space-y-1">
                        {joinRequests.map((req: any) => (
                          <motion.div
                            key={req._id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-2 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-900/10"
                          >
                            <div className="flex items-center gap-2">
                              {req.user?.avatar ? (
                                <img src={req.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                  <UserIcon className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{req.user?.name || 'Unknown'}</p>
                                {req.user?.department && (
                                  <p className="text-[10px] text-muted-foreground truncate">{req.user.department}</p>
                                )}
                              </div>
                            </div>
                            {req.message && (
                              <p className="text-[10px] italic text-muted-foreground mt-1">"{req.message}"</p>
                            )}
                            <div className="flex gap-1 mt-1.5">
                              <button
                                onClick={() => reviewJoinRequestMutation.mutate({ requestId: req._id, status: 'approved' })}
                                disabled={reviewJoinRequestMutation.isPending}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-[10px] hover:bg-green-700 disabled:opacity-50"
                              >
                                <UserCheck className="h-2.5 w-2.5" /> Approve
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await confirm({ title: 'Reject Join Request', message: `Reject ${req.user?.name || 'this user'}'s request to join the group?`, confirmLabel: 'Reject', variant: 'danger' });
                                  if (ok) reviewJoinRequestMutation.mutate({ requestId: req._id, status: 'rejected' });
                                }}
                                disabled={reviewJoinRequestMutation.isPending}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 border border-destructive/40 text-destructive rounded text-[10px] hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <X className="h-2.5 w-2.5" /> Reject
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {(group.members || []).map((member: any, i: number) => (
                      <FadeIn key={member._id} delay={i * 0.02} direction="up" distance={8}>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group/member">
                          <div className="relative shrink-0">
                            {member.avatar ? (
                              <img src={member.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            {online.has(member._id) && (
                              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                            )}
                          </div>
                          <Link
                            to={`/members/${member._id}`}
                            className="text-xs truncate flex-1 hover:text-primary"
                          >
                            {member.name}
                          </Link>
                          {canManageMembers && member._id !== user?._id && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({ title: 'Remove Member', message: `Remove ${member.name} from this group?`, confirmLabel: 'Remove', variant: 'danger' });
                                if (ok) removeMemberMutation.mutate(member._id);
                              }}
                              disabled={removeMemberMutation.isPending}
                              className="p-0.5 rounded opacity-0 group-hover/member:opacity-100 transition-opacity hover:bg-accent text-muted-foreground hover:text-destructive"
                              title="Remove member"
                            >
                              <UserMinus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Forward modal */}
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
