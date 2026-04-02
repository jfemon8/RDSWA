import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { Search, Loader2, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';

export default function AdminDonationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-donations', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/donations?${params}`);
      return data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/donations/${id}/verify`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-donations'] }); toast.success('Donation verification updated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/donations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-donations'] }); toast.success('Donation deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const donations = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">Donation Management</h1>

      <FadeIn direction="up">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search donations..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-sm" />
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : donations.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No donations found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Donor</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Transaction</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d: any) => (
                  <tr key={d._id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      {d.donor?._id ? (
                        <Link to={`/members/${d.donor._id}`} className="font-medium hover:text-primary transition-colors">{d.donor.name}</Link>
                      ) : (
                        <span className="font-medium">{d.donorName || 'Anonymous'}</span>
                      )}
                    </td>
                    <td className="p-3 font-medium">BDT {d.amount}</td>
                    <td className="p-3 text-muted-foreground capitalize">{d.paymentMethod}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.transactionId || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        d.paymentStatus === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : d.paymentStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {d.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(d.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {d.paymentStatus !== 'verified' && (
                          <button onClick={() => verifyMutation.mutate({ id: d._id, status: 'verified' })} title="Verify"
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {d.paymentStatus !== 'rejected' && (
                          <button onClick={() => verifyMutation.mutate({ id: d._id, status: 'rejected' })} title="Reject"
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={async () => {
                            const ok = await confirm({ title: 'Delete Donation', message: 'Are you sure?', confirmLabel: 'Delete', variant: 'danger' });
                            if (ok) deleteMutation.mutate(d._id);
                          }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
