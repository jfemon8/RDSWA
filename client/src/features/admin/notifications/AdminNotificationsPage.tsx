import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FadeIn } from '@/components/reactbits';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { Send, Loader2, Bell, Radio, History, Trash2, CheckSquare, Square } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { formatDate, formatTime } from '@/lib/date';
import { stripHtml } from '@/lib/stripHtml';
import { motion, AnimatePresence } from 'motion/react';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

type Tab = 'send' | 'history';

export default function AdminNotificationsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const [tab, setTab] = useState<Tab>('send');

  return (
    <div className="container mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Notifications</h1>

      <div className="flex gap-2 mb-6 border-b">
        {(['send', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'send' ? 'Send' : 'History'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'send' ? (
          <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SendPanel isSuperAdmin={isSuperAdmin} />
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HistoryPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SendPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [type, setType] = useState<'broadcast' | 'targeted'>('targeted');
  const toast = useToast();
  const [form, setForm] = useState({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (type === 'broadcast') {
        const { data } = await api.post('/notifications/broadcast', { title: form.title, message: form.message, link: form.link });
        return data;
      }
      const payload: any = { title: form.title, message: form.message, link: form.link };
      if (form.targetRole) payload.targetRole = form.targetRole;
      if (form.targetBatch) payload.targetBatch = Number(form.targetBatch);
      const { data } = await api.post('/notifications/targeted', payload);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Notification sent!');
      setForm({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to send notification'); } },
  });

  return (
    <FadeIn direction="up">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setType('targeted')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
            type === 'targeted' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
          }`}>
          <Bell className="h-4 w-4" /> Targeted
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setType('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
              type === 'broadcast' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            <Radio className="h-4 w-4" /> Broadcast (All)
          </button>
        )}
      </div>

      <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Notification title is required'; if (!form.message.trim()) errs.message = 'Notification message is required'; if (Object.keys(errs).length) { setErrors(errs); return; } sendMutation.mutate(); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Title</label>
          <input value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
            className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.title ? 'border-red-500' : ''}`} required />
          <FieldError message={errors.title} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Message</label>
          <textarea value={form.message} onChange={(e) => { setForm({ ...form, message: e.target.value }); setErrors((prev) => { const { message, ...rest } = prev; return rest; }); }} rows={4}
            className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.message ? 'border-red-500' : ''}`} required />
          <FieldError message={errors.message} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Link (optional)</label>
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/events/..."
            className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>

        {type === 'targeted' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Target Role</label>
              <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                <option value="">All roles</option>
                <option value="user">User</option>
                <option value="member">Member</option>
                <option value="alumni">Alumni</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Target Batch</label>
              <input type="number" value={form.targetBatch} onChange={(e) => setForm({ ...form, targetBatch: e.target.value })}
                placeholder="e.g. 5" className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={sendMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Notification
        </button>
      </form>
    </FadeIn>
  );
}

function HistoryPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = usePageParam();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notifications', 'all', typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '30', page: String(page) });
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/notifications/admin/all?${params}`);
      return data;
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/notifications/admin/bulk-delete', { ids }),
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications', 'all'] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} notification${ids.length > 1 ? 's' : ''} deleted`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Bulk delete failed'),
  });

  const notifications = data?.data || [];
  const pagination = data?.pagination;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const selectAll = () => {
    if (selectedIds.size === notifications.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(notifications.map((n: any) => n._id)));
  };

  return (
    <FadeIn direction="up">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {pagination?.total ?? 0} total notifications
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
          >
            <option value="">All types</option>
            <option value="announcement">Announcement</option>
            <option value="system">System</option>
            <option value="event">Event</option>
            <option value="vote">Vote</option>
            <option value="skill_endorsed">Skill endorsement</option>
          </select>
          {selectedIds.size > 0 && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete selected',
                  message: `Delete ${selectedIds.size} notification${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                });
                if (ok) bulkDeleteMutation.mutate([...selectedIds]);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Spinner size="md" />
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          No notifications found.
        </div>
      ) : (
        <>
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            {selectedIds.size === notifications.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {selectedIds.size === notifications.length ? 'Deselect all' : 'Select all'}
          </button>
          <div className="border rounded-lg divide-y bg-card">
            {notifications.map((n: any) => (
              <motion.div
                key={n._id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 flex items-start gap-3 hover:bg-accent/30"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(n._id)}
                  onChange={() => toggleSelect(n._id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                      {n.type}
                    </span>
                    {n.isRead ? (
                      <span className="text-[10px] text-muted-foreground">read</span>
                    ) : (
                      <span className="text-[10px] text-primary font-semibold">unread</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{stripHtml(n.message)}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    To: {n.recipient?.name || 'Unknown'} ({n.recipient?.email || '—'})
                    {' · '}
                    {formatDate(n.createdAt)} {formatTime(n.createdAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </>
      )}
    </FadeIn>
  );
}
