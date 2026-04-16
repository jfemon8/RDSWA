import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Loader2, Trash2 } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';

export default function AdminMentorshipPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-mentorships', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/mentorships/admin/all?${params}`);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mentorships/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-mentorships'] }); toast.success('Mentorship deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const mentorships = data?.data || [];
  const pagination = data?.pagination;

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">Mentorship Management</h1>

      <FadeIn direction="up">
        <div className="flex gap-2 mb-6">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md bg-card text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : mentorships.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No mentorships found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Mentor</th>
                  <th className="text-left p-3 font-medium">Mentee</th>
                  <th className="text-left p-3 font-medium">Area</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mentorships.map((m: any) => (
                  <tr key={m._id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      <Link to={`/members/${m.mentor?._id}`} className="font-medium hover:text-primary transition-colors">{m.mentor?.name || '-'}</Link>
                    </td>
                    <td className="p-3">
                      <Link to={`/members/${m.mentee?._id}`} className="hover:text-primary transition-colors">{m.mentee?.name || '-'}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{m.area || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(m.createdAt)}</td>
                    <td className="p-3">
                      <button onClick={async () => {
                        const ok = await confirm({ title: 'Delete Mentorship', message: `Delete this mentorship record? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                        if (ok) deleteMutation.mutate(m._id);
                      }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
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
