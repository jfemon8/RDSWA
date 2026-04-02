import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Search, Loader2, Trash2, Pin, Lock } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';

export default function AdminForumPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const CATEGORIES = ['General', 'Academic', 'Events', 'Career', 'Help', 'Off-Topic'];

  const { data, isLoading } = useQuery({
    queryKey: ['admin-forum', search, category, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (category) params.set('category', category);
      const { data } = await api.get(`/communication/forum?${params}`);
      return data;
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/communication/forum/${id}`, { isPinned: pinned }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-forum'] }); toast.success('Updated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const lockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      api.patch(`/communication/forum/${id}`, { isLocked: locked }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-forum'] }); toast.success('Updated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/communication/forum/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-forum'] }); toast.success('Topic deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const topics = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = search
    ? topics.filter((t: any) => t.title?.toLowerCase().includes(search.toLowerCase()))
    : topics;

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">Forum Management</h1>

      <FadeIn direction="up">
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-sm" />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md bg-card text-sm">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No topics found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Topic</th>
                  <th className="text-left p-3 font-medium">Author</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Replies</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t._id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      <Link to={`/dashboard/forum/${t._id}`} className="font-medium hover:text-primary transition-colors flex items-center gap-1.5">
                        {t.isPinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                        {t.isLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="truncate max-w-[250px]">{t.title}</span>
                      </Link>
                    </td>
                    <td className="p-3">
                      {t.author?._id ? (
                        <Link to={`/members/${t.author._id}`} className="text-sm hover:text-primary transition-colors">{t.author.name}</Link>
                      ) : <span className="text-muted-foreground">Unknown</span>}
                    </td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-muted rounded-full text-xs">{t.category || 'General'}</span></td>
                    <td className="p-3 text-muted-foreground">{t.replyCount || 0}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(t.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => pinMutation.mutate({ id: t._id, pinned: !t.isPinned })}
                          title={t.isPinned ? 'Unpin' : 'Pin'}
                          className={`p-1.5 rounded hover:bg-accent ${t.isPinned ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          <Pin className="h-4 w-4" />
                        </button>
                        <button onClick={() => lockMutation.mutate({ id: t._id, locked: !t.isLocked })}
                          title={t.isLocked ? 'Unlock' : 'Lock'}
                          className={`p-1.5 rounded hover:bg-accent ${t.isLocked ? 'text-red-500' : 'text-muted-foreground'}`}>
                          <Lock className="h-4 w-4" />
                        </button>
                        <button onClick={async () => {
                          const ok = await confirm({ title: 'Delete Topic', message: 'Are you sure? This will also delete all replies.', confirmLabel: 'Delete', variant: 'danger' });
                          if (ok) deleteMutation.mutate(t._id);
                        }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
        </div>
      )}
    </div>
  );
}
