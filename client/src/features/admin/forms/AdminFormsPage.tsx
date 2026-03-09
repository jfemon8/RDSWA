import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';

export default function AdminFormsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (statusFilter) filters.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['forms', 'admin', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/forms?${params}`);
      return data;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: string; comment?: string }) =>
      api.patch(`/forms/${id}/review`, { status, reviewComment: comment }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forms'] }),
  });

  const forms = data?.data || [];
  const pagination = data?.pagination;

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-2xl font-bold mb-6">Form Submissions</h1>

        <div className="flex gap-2 mb-6">
          {['', 'pending', 'under_review', 'approved', 'rejected'].map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md border capitalize ${
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
              }`}>
              {s ? s.replace('_', ' ') : 'All'}
            </motion.button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No submissions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((f: any, index: number) => (
              <FadeIn key={f._id} direction="up" delay={index * 0.05} duration={0.4}>
                <motion.div
                  whileHover={{ scale: 1.01, backgroundColor: 'var(--accent)' }}
                  transition={{ duration: 0.2 }}
                  className="border rounded-lg p-4 bg-background"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium capitalize">{f.type?.replace('_', ' ')} Form</p>
                      <p className="text-sm text-muted-foreground">
                        By {f.submittedBy?.name || 'Unknown'} · {new Date(f.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      f.status === 'approved' ? 'bg-green-100 text-green-700'
                        : f.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>{f.status?.replace('_', ' ')}</span>
                  </div>

                  {f.data?.reason && <p className="text-sm text-muted-foreground mb-3">{f.data.reason}</p>}

                  {(f.status === 'pending' || f.status === 'under_review') && (
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => reviewMutation.mutate({ id: f._id, status: 'approved' })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">
                        <CheckCircle className="h-3 w-3" /> Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => reviewMutation.mutate({ id: f._id, status: 'rejected', comment: 'Rejected by admin' })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">
                        <XCircle className="h-3 w-3" /> Reject
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              </FadeIn>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
