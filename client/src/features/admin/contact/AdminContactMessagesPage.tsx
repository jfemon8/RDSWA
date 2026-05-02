import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Mail, MailOpen, MailCheck, Archive, Trash2, Send, X, Inbox, Clock,
  CheckCircle2, Loader2, ExternalLink, User, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FadeIn, BlurText, SpotlightCard } from '@/components/reactbits';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import SEO from '@/components/SEO';
import { formatDateTime } from '@/lib/date';

type Status = 'new' | 'read' | 'replied' | 'archived';

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: Status;
  reply?: string;
  repliedBy?: { _id: string; name: string; email: string; avatar?: string };
  repliedAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  new: number;
  read: number;
  replied: number;
  archived: number;
  total: number;
}

const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  read: 'Read',
  replied: 'Replied',
  archived: 'Archived',
};

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  read: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  replied: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-muted text-muted-foreground',
};

export default function AdminContactMessagesPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser ? hasMinRole(currentUser.role, UserRole.ADMIN) : false;
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = usePageParam();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (statusFilter) filters.status = statusFilter;
  if (search) filters.search = search;

  const { data: listData, isLoading } = useQuery({
    queryKey: queryKeys.contactMessages.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/settings/contact/messages?${params}`);
      return data;
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: queryKeys.contactMessages.stats,
    queryFn: async () => {
      const { data } = await api.get('/settings/contact/messages/stats');
      return data.data;
    },
    staleTime: 30_000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.patch(`/settings/contact/messages/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactMessages.all });
      toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/contact/messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactMessages.all });
      setSelectedId(null);
      toast.success('Message deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const messages: ContactMessage[] = listData?.data || [];
  const pagination = listData?.pagination;

  const statCards = [
    { key: 'new', label: 'New', value: stats?.new ?? 0, icon: Inbox, color: 'rgba(59, 130, 246, 0.15)' },
    { key: 'read', label: 'Awaiting Reply', value: stats?.read ?? 0, icon: Clock, color: 'rgba(245, 158, 11, 0.15)' },
    { key: 'replied', label: 'Replied', value: stats?.replied ?? 0, icon: CheckCircle2, color: 'rgba(34, 197, 94, 0.15)' },
    { key: 'archived', label: 'Archived', value: stats?.archived ?? 0, icon: Archive, color: 'rgba(148, 163, 184, 0.15)' },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <SEO title="Contact Messages" description="Review and respond to contact form submissions." />

      <div className="mb-6">
        <BlurText
          text="Contact Messages"
          className="text-xl sm:text-2xl font-bold mb-1"
          delay={60}
          animateBy="words"
          direction="bottom"
        />
        <p className="text-sm text-muted-foreground">
          Review messages submitted through the public contact form and reply directly from the admin panel.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          const active = statusFilter === s.key;
          return (
            <FadeIn key={s.key} direction="up" delay={i * 0.05}>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setStatusFilter(active ? '' : (s.key as Status)); setPage(1); }}
                className={`w-full text-left rounded-xl border transition-colors ${active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
              >
                <SpotlightCard className="bg-card border-0 p-4" spotlightColor={s.color}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                      <p className="text-xl font-bold">{s.value.toLocaleString()}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.button>
            </FadeIn>
          );
        })}
      </div>

      {/* Filters */}
      <FadeIn direction="up" delay={0.2}>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, subject..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as Status | ''); setPage(1); }}
            className="px-3 py-2 border rounded-md bg-card text-foreground text-sm"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <Spinner size="md" />
      ) : messages.length === 0 ? (
        <FadeIn direction="up" delay={0.25}>
          <div className="text-center py-12 border rounded-xl bg-card">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No contact messages match your filters.</p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.25}>
          <div className="border rounded-lg bg-card divide-y">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.button
                  key={m._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => setSelectedId(m._id)}
                  className="w-full text-left p-4 hover:bg-accent/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${m.status === 'new' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-muted text-muted-foreground'}`}>
                      {m.status === 'replied' ? <MailCheck className="h-4 w-4" /> : m.status === 'new' ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`font-medium truncate ${m.status === 'new' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {m.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">&lt;{m.email}&gt;</span>
                      </div>
                      <p className={`text-sm truncate ${m.status === 'new' ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
                        {m.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {m.message.slice(0, 120)}{m.message.length > 120 ? '…' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:flex-col sm:items-end">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAt)}</span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </FadeIn>
      )}

      <AnimatePresence>
        {selectedId && (
          <MessageDetailDrawer
            id={selectedId}
            isAdmin={isAdmin}
            onClose={() => setSelectedId(null)}
            onArchive={() => updateStatusMutation.mutate({ id: selectedId, status: 'archived' })}
            onUnarchive={() => updateStatusMutation.mutate({ id: selectedId, status: 'read' })}
            onDelete={async () => {
              const ok = await confirm({
                title: 'Delete Message',
                message: 'Permanently delete this contact message? This cannot be undone.',
                confirmLabel: 'Delete',
                variant: 'danger',
              });
              if (ok) deleteMutation.mutate(selectedId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════
// Detail drawer with reply composer
// ═══════════════════════════════════════════

function MessageDetailDrawer({
  id, isAdmin, onClose, onArchive, onUnarchive, onDelete,
}: {
  id: string;
  isAdmin: boolean;
  onClose: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [showReply, setShowReply] = useState(false);

  const { data, isLoading } = useQuery<ContactMessage>({
    queryKey: queryKeys.contactMessages.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/settings/contact/messages/${id}`);
      return data.data;
    },
  });

  useEffect(() => {
    if (data) {
      setSubject(`Re: ${data.subject}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.contactMessages.all });
    }
  }, [data, queryClient]);

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/settings/contact/messages/${id}/reply`, { reply, subject }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactMessages.all });
      toast.success('Reply sent');
      setReply('');
      setShowReply(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send reply'),
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-xl bg-background border-l shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold">Message Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[data.status]}`}>
                  {STATUS_LABEL[data.status]}
                </span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateTime(data.createdAt)}
                </span>
              </div>
              <h3 className="text-lg font-semibold break-words">{data.subject}</h3>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground break-words">{data.name}</p>
                <a
                  href={`mailto:${data.email}`}
                  className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1"
                >
                  {data.email}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Message</h4>
              <div className="p-4 rounded-lg border bg-card text-sm whitespace-pre-wrap break-words text-foreground/90">
                {data.message}
              </div>
            </div>

            {data.reply && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <MailCheck className="h-3 w-3" /> Sent Reply
                </h4>
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 text-sm whitespace-pre-wrap break-words">
                  {data.reply}
                </div>
                {data.repliedBy && data.repliedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Replied by {data.repliedBy.name} · {formatDateTime(data.repliedAt)}
                  </p>
                )}
              </div>
            )}

            <AnimatePresence>
              {showReply && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 p-4 border rounded-lg bg-card">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Reply</label>
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={8}
                        placeholder="Write your reply here..."
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                        maxLength={10000}
                      />
                      <div className="text-right text-[10px] text-muted-foreground mt-0.5">
                        {reply.length}/10000
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The reply will be emailed to <strong>{data.email}</strong>. A copy will be saved here.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Sticky footer actions */}
        {data && (
          <div className="border-t p-3 sm:p-4 bg-background sticky bottom-0 flex flex-wrap gap-2">
            {!showReply ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowReply(true)}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                >
                  <Mail className="h-4 w-4" /> {data.reply ? 'Reply Again' : 'Reply'}
                </motion.button>
                {data.status !== 'archived' ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onArchive}
                    className="flex items-center justify-center gap-2 px-3 py-2 border rounded-md hover:bg-accent text-sm"
                  >
                    <Archive className="h-4 w-4" /> Archive
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onUnarchive}
                    className="flex items-center justify-center gap-2 px-3 py-2 border rounded-md hover:bg-accent text-sm"
                  >
                    <Inbox className="h-4 w-4" /> Unarchive
                  </motion.button>
                )}
                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onDelete}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 text-sm"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </motion.button>
                )}
              </>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: replyMutation.isPending ? 1 : 1.03 }}
                  whileTap={{ scale: replyMutation.isPending ? 1 : 0.97 }}
                  onClick={() => replyMutation.mutate()}
                  disabled={reply.trim().length < 5 || !subject.trim() || replyMutation.isPending}
                  className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                >
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                </motion.button>
                <button
                  onClick={() => { setShowReply(false); setReply(''); }}
                  className="flex items-center justify-center gap-2 px-3 py-2 border rounded-md hover:bg-accent text-sm"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </motion.aside>
    </>
  );
}
