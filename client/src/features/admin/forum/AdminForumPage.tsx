import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Search, Trash2, Pin, Lock } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function AdminForumPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = usePageParam();

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
        <Spinner size="md" />
      ) : filtered.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No topics found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          {(() => {
            const renderActions = (t: any) => (
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
            );

            return (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[18%]" />
                      <col className="w-[14%]" />
                      <col className="w-[9%]" />
                      <col className="w-[13%]" />
                      <col className="w-[12%]" />
                    </colgroup>
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
                            <Link to={`/dashboard/forum/${t._id}`} className="font-medium hover:text-primary transition-colors inline-flex items-center gap-1.5 max-w-full">
                              {t.isPinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                              {t.isLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <span className="truncate">{t.title}</span>
                            </Link>
                          </td>
                          <td className="p-3 truncate">
                            {t.author?._id ? (
                              <Link to={`/members/${t.author._id}`} className="text-sm hover:text-primary transition-colors truncate block" title={t.author.name}>{t.author.name}</Link>
                            ) : <span className="text-muted-foreground">Unknown</span>}
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 bg-muted rounded-full text-xs whitespace-nowrap">{t.category || 'General'}</span></td>
                          <td className="p-3 text-muted-foreground">{t.replyCount || 0}</td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.createdAt)}</td>
                          <td className="p-3">{renderActions(t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="lg:hidden space-y-3">
                  {filtered.map((t: any) => (
                    <div key={t._id} className="border rounded-lg p-4 bg-card">
                      <Link to={`/dashboard/forum/${t._id}`} className="font-medium hover:text-primary transition-colors flex items-start gap-1.5 mb-2">
                        {t.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                        {t.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                        <span className="break-words">{t.title}</span>
                      </Link>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                        <span className="px-2 py-0.5 bg-muted rounded-full whitespace-nowrap">{t.category || 'General'}</span>
                        <span>{t.replyCount || 0} replies</span>
                        <span>{formatDate(t.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground truncate">
                          {t.author?._id ? (
                            <Link to={`/members/${t.author._id}`} className="hover:text-primary transition-colors">by {t.author.name}</Link>
                          ) : 'Unknown author'}
                        </span>
                        {renderActions(t)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </FadeIn>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}
