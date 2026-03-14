import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useDMSocket } from '@/hooks/useSocket';
import {
  MessagesSquare, Send, Loader2, Search, ArrowLeft,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { formatTime, formatDateCustom } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';

export default function MessagesPage() {
  const [selectedUser, setSelectedUser] = useState<{ _id: string; name: string; avatar?: string } | null>(null);

  return (
    <div className="container mx-auto">
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
                    {conv.lastMessage?.content}
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
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    mutationFn: () => api.post(`/communication/dm/${partner._id}`, { content: message }),
    onSuccess: () => {
      setMessage('');
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

  const messages = data?.data || [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) sendMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <button
          onClick={onBack}
          className="p-2 rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar src={partner.avatar} name={partner.name} />
        <span className="font-medium">{partner.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
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
            return (
              <motion.div
                key={msg._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        if (!message.trim()) { setErrors({ message: 'Message cannot be empty' }); return; }
        sendMutation.mutate();
      }} noValidate className="pt-3 border-t space-y-1">
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
