import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Trash2 } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function AdminMentorshipPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = usePageParam();

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
        <Spinner size="md" />
      ) : mentorships.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No mentorships found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          {(() => {
            const renderDeleteBtn = (m: any) => (
              <button onClick={async () => {
                const ok = await confirm({ title: 'Delete Mentorship', message: `Delete this mentorship record? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                if (ok) deleteMutation.mutate(m._id);
              }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            );
            const renderStatusBadge = (m: any) => (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${statusColors[m.status] || 'bg-muted text-muted-foreground'}`}>
                {m.status}
              </span>
            );

            return (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                      <col className="w-[20%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                    </colgroup>
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
                          <td className="p-3 truncate">
                            <Link to={`/members/${m.mentor?._id}`} className="font-medium hover:text-primary transition-colors truncate block" title={m.mentor?.name}>{m.mentor?.name || '-'}</Link>
                          </td>
                          <td className="p-3 truncate">
                            <Link to={`/members/${m.mentee?._id}`} className="hover:text-primary transition-colors truncate block" title={m.mentee?.name}>{m.mentee?.name || '-'}</Link>
                          </td>
                          <td className="p-3 text-muted-foreground truncate" title={m.area || ''}>{m.area || '-'}</td>
                          <td className="p-3">{renderStatusBadge(m)}</td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</td>
                          <td className="p-3">{renderDeleteBtn(m)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="lg:hidden space-y-3">
                  {mentorships.map((m: any) => (
                    <div key={m._id} className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">Mentor</div>
                          <Link to={`/members/${m.mentor?._id}`} className="font-medium hover:text-primary transition-colors break-words">{m.mentor?.name || '-'}</Link>
                        </div>
                        {renderStatusBadge(m)}
                      </div>
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground">Mentee</div>
                        <Link to={`/members/${m.mentee?._id}`} className="hover:text-primary transition-colors break-words">{m.mentee?.name || '-'}</Link>
                      </div>
                      {m.area && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground">Area</div>
                          <p className="text-sm break-words">{m.area}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
                        {renderDeleteBtn(m)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </FadeIn>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
      )}
    </div>
  );
}
