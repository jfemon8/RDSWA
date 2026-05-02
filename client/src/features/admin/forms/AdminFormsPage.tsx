import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { usePageParam } from '@/hooks/usePageParam';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { CheckCircle, XCircle, FileText, MessageSquare, ChevronDown, ChevronUp, Trash2, Eye, Download, Clock, Paperclip } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { stripHtml } from '@/lib/stripHtml';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import RichContent from '@/components/ui/RichContent';
import { proxyFileUrl } from '@/lib/fileProxy';
import { getDocLabel, DEFAULT_MEMBERSHIP_CRITERIA, type MembershipCriteria } from '@/lib/membershipDocs';

export default function AdminFormsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = usePageParam();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['forms', 'admin', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/forms?${params}`);
      return data;
    },
  });

  const { data: criteriaData } = useQuery<MembershipCriteria>({
    queryKey: ['settings', 'membership-criteria'],
    queryFn: async () => {
      const { data } = await api.get('/settings/membership-criteria');
      return { ...DEFAULT_MEMBERSHIP_CRITERIA, ...(data.data || {}) };
    },
  });
  const maxPendingDays = criteriaData?.maxPendingDays ?? DEFAULT_MEMBERSHIP_CRITERIA.maxPendingDays;

  const deleteFormMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/forms/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); toast.success('Form deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete form'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: string; comment?: string }) =>
      api.patch(`/forms/${id}/review`, { status, reviewComment: comment }),
    onSuccess: (_data, variables) => { queryClient.invalidateQueries({ queryKey: ['forms'] }); toast.success(variables.status === 'approved' ? 'Form approved' : 'Form rejected'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Review failed'); },
  });

  const forms = data?.data || [];
  const pagination = data?.pagination;

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Form Submissions</h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: '', label: 'All Types' },
            { key: 'membership', label: 'Membership' },
            { key: 'construction_fund', label: 'Construction Fund' },
            { key: 'alumni', label: 'Alumni' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTypeFilter(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                typeFilter === t.key ? 'bg-muted font-medium border-foreground/20' : 'hover:bg-accent'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Spinner size="md" />
        ) : forms.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No submissions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map((f: any, index: number) => {
              const isPending = f.status === 'pending' || f.status === 'under_review';
              const ageDays = Math.floor((Date.now() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              const overdue = isPending && ageDays > maxPendingDays;
              const attachments: Array<{ name: string; url: string }> = Array.isArray(f.attachments) ? f.attachments : [];
              return (
                <FadeIn key={f._id} direction="up" delay={index * 0.05} duration={0.4}>
                  <div className="border rounded-lg bg-card">
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground capitalize flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-primary shrink-0" /> {f.type?.replace('_', ' ')} Form
                          </p>
                          <p className="text-sm text-muted-foreground">
                            By {f.submittedBy?.name || 'Unknown'} · {formatDate(f.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {overdue && (
                            <span
                              title={`Pending ${ageDays} days — over the ${maxPendingDays}-day SLA target`}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            >
                              <Clock className="h-3 w-3" /> Overdue {ageDays}d
                            </span>
                          )}
                          {attachments.length > 0 && (
                            <span
                              title={`${attachments.length} attached document${attachments.length === 1 ? '' : 's'}`}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <Paperclip className="h-3 w-3" /> {attachments.length}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            f.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : f.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>{f.status?.replace('_', ' ')}</span>
                          <button
                            onClick={() => setExpandedId(expandedId === f._id ? null : f._id)}
                            className="p-1 hover:bg-accent rounded"
                            aria-label={expandedId === f._id ? 'Collapse' : 'Expand'}
                          >
                            {expandedId === f._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {isSuperAdmin && (
                            <button onClick={async () => {
                                const ok = await confirm({ title: 'Delete Form Submission', message: 'Delete this form submission? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
                                if (ok) deleteFormMutation.mutate(f._id);
                              }} title="Delete"
                              className="p-1 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {f.data?.reason && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{stripHtml(f.data.reason)}</p>
                      )}

                      {/* Review comment display (collapsed view) */}
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

                    {/* Expanded: full details + review controls */}
                    <AnimatePresence>
                      {expandedId === f._id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t p-4 sm:p-6 space-y-4">
                            {/* Reason as rich content (preserves formatting) */}
                            {f.data?.reason && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Reason / Details</p>
                                <div className="rounded-md border bg-background/50 p-3">
                                  <RichContent html={String(f.data.reason)} />
                                </div>
                              </div>
                            )}

                            {/* Other submitted data fields (excluding reason) */}
                            {f.data && Object.keys(f.data).filter((k) => k !== 'reason').length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Submitted Data</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  {Object.entries(f.data)
                                    .filter(([key]) => key !== 'reason')
                                    .map(([key, val]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                        <span className="font-medium text-foreground break-all">{stripHtml(val)}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Attachments — view / download via Cloudinary proxy */}
                            {attachments.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Attached Documents ({attachments.length})</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {attachments.map((a, i) => (
                                    <AttachmentRow key={i} name={a.name} url={a.url} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Submitter context */}
                            <div className="text-xs text-muted-foreground">
                              Submitted by <span className="font-medium text-foreground">{f.submittedBy?.name || 'Unknown'}</span>
                              {f.submittedBy?.email && <> ({f.submittedBy.email})</>} on {formatDate(f.createdAt)}
                            </div>

                            {/* Review controls (pending only) */}
                            {isPending ? (
                              <div className="space-y-2 pt-2 border-t">
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Review Comment</label>
                                <textarea
                                  value={reviewComment[f._id] || ''}
                                  onChange={(e) => setReviewComment({ ...reviewComment, [f._id]: e.target.value })}
                                  placeholder="Add a comment or note for this review..."
                                  rows={2}
                                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => reviewMutation.mutate({ id: f._id, status: 'approved', comment: reviewComment[f._id] })}
                                    disabled={reviewMutation.isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                                    <CheckCircle className="h-3 w-3" /> Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const ok = await confirm({ title: 'Reject Form Submission', message: `Reject this form submission from ${f.submittedBy?.name || 'this user'}?`, confirmLabel: 'Reject', variant: 'danger' });
                                      if (ok) reviewMutation.mutate({ id: f._id, status: 'rejected', comment: reviewComment[f._id] || 'Rejected by admin' });
                                    }}
                                    disabled={reviewMutation.isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                                    <XCircle className="h-3 w-3" /> Reject
                                  </button>
                                </div>
                              </div>
                            ) : (
                              f.reviewedBy && (
                                <p className="text-xs text-muted-foreground pt-2 border-t">
                                  Reviewed by {f.reviewedBy?.name || 'admin'} on {f.reviewedAt ? formatDate(f.reviewedAt) : 'N/A'}
                                </p>
                              )
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
        )}
      </div>
    </FadeIn>
  );
}

/**
 * Single attachment row with view (in-browser preview) and download buttons.
 * Routes Cloudinary URLs through the backend proxy so PDFs preview inline
 * and downloads keep their filename.
 */
function AttachmentRow({ name, url }: { name: string; url: string }) {
  const label = getDocLabel(name);
  const filename = `${name || 'document'}${guessExt(url)}`;
  const previewUrl = proxyFileUrl(url, filename, true);
  const downloadUrl = proxyFileUrl(url, filename, false);
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
      {isImage ? (
        <img src={url} alt={label} className="h-10 w-10 rounded object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded bg-muted grid place-items-center shrink-0">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate" title={label}>{label}</p>
        <p className="text-[11px] text-muted-foreground uppercase">{name}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </a>
        <a
          href={downloadUrl}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function guessExt(url: string): string {
  const m = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  return m ? `.${m[1]}` : '';
}
