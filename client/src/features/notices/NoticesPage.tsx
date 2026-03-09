import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';

export default function NoticesPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '12' };
  if (category) filters.category = category;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notices.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/notices?${params}`);
      return data;
    },
  });

  const notices = data?.data || [];
  const pagination = data?.pagination;

  const categories = ['', 'general', 'academic', 'event', 'urgent', 'financial', 'other'];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Notices</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((c) => (
          <button key={c} onClick={() => { setCategory(c); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors capitalize ${
              category === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No notices found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notices.map((n: any) => (
              <Link key={n._id} to={`/notices/${n._id}`}
                className={`block p-4 border rounded-lg bg-background hover:shadow-sm transition-shadow ${
                  n.priority === 'urgent' ? 'border-red-300 dark:border-red-800' : ''
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                      <h3 className="font-semibold truncate">{n.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.content?.replace(/<[^>]*>/g, '')}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="capitalize">{n.category}</span>
                      <span>{new Date(n.publishedAt || n.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                    </div>
                  </div>
                  {n.priority !== 'normal' && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      n.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {n.priority}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
