import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Search, Loader2, Trash2, ExternalLink, Briefcase } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs', search, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/jobs?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }); toast.success('Job deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const jobs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">Job Board Management</h1>

      <FadeIn direction="up">
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search jobs..." className="w-full pl-10 pr-3 py-2.5 border rounded-md bg-card text-sm" />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border rounded-md bg-card text-sm">
            <option value="">All Types</option>
            <option value="full-time">Full Time</option>
            <option value="part-time">Part Time</option>
            <option value="internship">Internship</option>
            <option value="remote">Remote</option>
            <option value="contract">Contract</option>
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : jobs.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No jobs found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Company</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Vacancy</th>
                  <th className="text-left p-3 font-medium">Deadline</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Posted By</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => {
                  const expired = !!(j.deadline && new Date(j.deadline).getTime() < Date.now());
                  return (
                  <tr key={j._id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      <Link to={`/dashboard/jobs/${j._id}`} className="font-medium hover:text-primary transition-colors flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" /> {j.title}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{j.company}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{j.type?.replace('-', ' ')}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {typeof j.vacancy === 'number' && j.vacancy > 0 ? j.vacancy : '-'}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {j.deadline ? formatDate(j.deadline) : '-'}
                    </td>
                    <td className="p-3">
                      {expired ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Expired</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                      )}
                    </td>
                    <td className="p-3">
                      {j.postedBy?._id ? (
                        <Link to={`/members/${j.postedBy._id}`} className="text-sm hover:text-primary transition-colors">{j.postedBy.name}</Link>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(j.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {j.applicationLink && (
                          <a href={j.applicationLink} target="_blank" rel="noopener noreferrer" title="Application Link"
                            className="p-1.5 text-primary hover:bg-primary/10 rounded">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button onClick={async () => {
                          const ok = await confirm({ title: 'Delete Job', message: `Delete job listing "${j.title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                          if (ok) deleteMutation.mutate(j._id);
                        }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
        </div>
      )}
    </div>
  );
}
