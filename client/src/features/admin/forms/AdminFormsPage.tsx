import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, CheckCircle, XCircle, FileText, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

export default function AdminFormsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

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
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Form Submissions</h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          {['', 'pending', 'under_review', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md border capitalize ${
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
              }`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
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
                <div
                  className="border rounded-lg bg-card"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-foreground capitalize">{f.type?.replace('_', ' ')} Form</p>
                        <p className="text-sm text-muted-foreground">
                          By {f.submittedBy?.name || 'Unknown'} · {new Date(f.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          f.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : f.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>{f.status?.replace('_', ' ')}</span>
                        <button
                          onClick={() => setExpandedId(expandedId === f._id ? null : f._id)}
                          className="p-1 hover:bg-accent rounded"
                        >
                          {expandedId === f._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {f.data?.reason && <p className="text-sm text-muted-foreground mb-2">{f.data.reason}</p>}

                    {/* Review comment display */}
                    {f.reviewComment && (
                      <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted text-sm">
                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Review Note: </span>
                          <span className="text-muted-foreground">{f.reviewComment}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded: Review with comment */}
                  <AnimatePresence>
                    {expandedId === f._id && (f.status === 'pending' || f.status === 'under_review') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t p-4 sm:p-6 space-y-3">
                          {/* Form data details */}
                          {f.data && Object.keys(f.data).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Submitted Data</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {Object.entries(f.data).map(([key, val]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                    <span className="font-medium text-foreground">{String(val)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Review Comment</label>
                            <textarea
                              value={reviewComment[f._id] || ''}
                              onChange={(e) => setReviewComment({ ...reviewComment, [f._id]: e.target.value })}
                              placeholder="Add a comment or note for this review..."
                              rows={2}
                              className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => reviewMutation.mutate({ id: f._id, status: 'approved', comment: reviewComment[f._id] })}
                              disabled={reviewMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                              <CheckCircle className="h-3 w-3" /> Approve
                            </button>
                            <button
                              onClick={() => reviewMutation.mutate({ id: f._id, status: 'rejected', comment: reviewComment[f._id] || 'Rejected by admin' })}
                              disabled={reviewMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {expandedId === f._id && f.status !== 'pending' && f.status !== 'under_review' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t p-4 sm:p-6">
                          {f.data && Object.keys(f.data).length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {Object.entries(f.data).map(([key, val]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                  <span className="font-medium text-foreground">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {f.reviewedBy && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed by {f.reviewedBy?.name || 'admin'} on {f.reviewedAt ? new Date(f.reviewedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
