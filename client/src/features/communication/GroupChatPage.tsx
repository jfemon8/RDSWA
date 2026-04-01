import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatSocket } from '@/hooks/useSocket';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import {
  ArrowLeft, Send, Loader2, Users, Trash2, Pencil,
  User as UserIcon, Globe, Building2, Hash, X, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { formatTime } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);

  // Real-time chat
  useChatSocket(id);

  const { data, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/groups/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const group = data?.group;
  const messages = data?.messages || [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/communication/groups/${id}/messages`, { content: message }),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['group', id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send message');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/communication/groups/${id}/messages/${messageId}`, { content }),
    onSuccess: () => {
      setEditingId(null);
      setEditContent('');
      queryClient.invalidateQueries({ queryKey: ['group', id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to edit message');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/communication/groups/${id}/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) sendMutation.mutate();
    }
  };

  const handleDelete = async (messageId: string) => {
    const ok = await confirm({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(messageId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return <div className="text-center py-12 text-muted-foreground">Group not found</div>;
  }

  const TypeIcon = TYPE_ICONS[group.type] || Hash;

  return (
    <div className="container mx-auto flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <button onClick={() => navigate('/dashboard/groups')} className="p-2 rounded-md hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {group.avatar ? (
            <img src={group.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <TypeIcon className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-sm truncate">{group.name}</h2>
          <p className="text-xs text-muted-foreground">{group.members?.length || 0} members</p>
        </div>
        <button
          onClick={() => setShowMembers(!showMembers)}
          className="p-2 rounded-md hover:bg-accent"
          title="Members"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg: any, i: number) => {
                const isMine = msg.sender?._id === user?._id;
                const canEdit = isMine;
                const canDelete = isMine || isAdmin;

                return (
                  <motion.div
                    key={msg._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.015 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                      {/* Sender name (for others) */}
                      {!isMine && (
                        <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">
                          {msg.sender?.name || 'Unknown'}
                        </p>
                      )}
                      <div className="flex items-end gap-1">
                        {isMine && (canEdit || canDelete) && editingId !== msg._id && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button
                                onClick={() => { setEditingId(msg._id); setEditContent(msg.content); }}
                                className="p-1 rounded hover:bg-accent"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(msg._id)} className="p-1 rounded hover:bg-accent">
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        )}
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
                            className={`px-3 py-2 rounded-lg text-sm ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-muted rounded-bl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {msg.attachments.map((att: any, ai: number) => (
                                  <a
                                    key={ai}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs underline opacity-80 hover:opacity-100 block"
                                  >
                                    {att.name || 'Attachment'}
                                  </a>
                                ))}
                              </div>
                            )}
                            <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        )}
                        {!isMine && canDelete && editingId !== msg._id && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDelete(msg._id)} className="p-1 rounded hover:bg-accent">
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setErrors({});
              if (!message.trim()) { setErrors({ message: 'Message cannot be empty' }); return; }
              sendMutation.mutate();
            }}
            noValidate
            className="pt-3 border-t space-y-1"
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <textarea
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setErrors((prev) => { const { message, ...rest } = prev; return rest; }); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className={`w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.message ? 'border-red-500' : ''}`}
                />
                <FieldError message={errors.message} />
              </div>
              <button
                type="submit"
                disabled={!message.trim() || sendMutation.isPending}
                className="self-end px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Members sidebar */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l overflow-hidden shrink-0"
            >
              <div className="p-3 w-60">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Members ({group.members?.length || 0})</h3>
                  <button onClick={() => setShowMembers(false)} className="p-1 rounded hover:bg-accent">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {(group.members || []).map((member: any, i: number) => (
                    <FadeIn key={member._id} delay={i * 0.02} direction="up" distance={8}>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {member.avatar ? (
                            <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs truncate">{member.name}</span>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
