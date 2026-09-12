import { useState } from 'react';
import { CardListSkeleton } from '@/components/ui/Skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { useToast } from '@/components/ui/Toast';
import { useAccordionToggle } from '@/hooks/useAccordionScroll';
import { CheckCircle, XCircle, FileText, MessageSquare, ChevronDown, ChevronUp, Trash2, Eye, Download, Clock, Paperclip } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { stripHtml } from '@/lib/stripHtml';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { Link } from 'react-router-dom';
import DocumentPreviewModal, { type DocumentPreviewTarget } from '@/components/ui/DocumentPreviewModal';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = useAccordionToggle(expandedId, setExpandedId);
  const [preview, setPreview] = useState<DocumentPreviewTarget | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;

  const {
    items: forms,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: ['forms', 'admin', filters],
    path: '/forms',
    filters,
    limit: 20,
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

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Form Submissions</h1>

        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 mb-6">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
            {['', 'pending', 'under_review', 'approved', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); }}
                className={`flex items-center justify-center px-3 py-2 sm:py-1.5 text-sm rounded-md border capitalize whitespace-nowrap transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                }`}>
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); }}
            className={`w-full sm:w-auto sm:ml-auto px-3 py-2 sm:py-1.5 border rounded-md bg-card text-foreground text-sm transition-colors ${
              typeFilter ? 'font-medium border-foreground/30' : ''
            }`}
          >
            <option value="">All Types</option>
            <option value="membership">Membership</option>
            <option value="construction_fund">Construction Fund</option>
            <option value="alumni">Alumni</option>
          </select>
        </div>

        {isLoading ? (
          <CardListSkeleton />
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
                  <div data-accordion-item={f._id} className="border rounded-lg bg-card">
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            onClick={() => toggleExpand(f._id)}
                            title="Details"
                            className="font-medium text-foreground capitalize flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="h-4 w-4 text-primary shrink-0" /> {f.type?.replace('_', ' ')} Form
                          </p>
                          <p className="text-sm text-muted-foreground">
                            By {f.submittedBy?.name || 'Unknown'} · {formatDate(f.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {overdue && (
                            <span
                              title={`Pending ${ageDays} days: over the ${maxPendingDays}-day SLA target`}
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
                            onClick={() => toggleExpand(f._id)}
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

                            {/* Attachments: view / download via Cloudinary proxy */}
                            {attachments.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Attached Documents ({attachments.length})</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {attachments.map((a, i) => (
                                    <AttachmentRow key={i} name={a.name} url={a.url} onPreview={setPreview} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Submitter context */}
                            <div className="text-xs text-muted-foreground">
                              Submitted by <UserLink user={f.submittedBy} />
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
                                  Reviewed by <UserLink user={f.reviewedBy} fallback="admin" /> on {f.reviewedAt ? formatDate(f.reviewedAt) : 'N/A'}
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

        <InfiniteScrollSentinel
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            endLabel={forms.length > 0 ? `All ${total} forms loaded` : undefined}
          />
      </div>

      <DocumentPreviewModal target={preview} onClose={() => setPreview(null)} />
    </FadeIn>
  );
}

/** Attachment row whose view and download buttons route through the backend proxy so PDFs preview inline and keep their filename. */
function AttachmentRow({
  name,
  url,
  onPreview,
}: {
  name: string;
  url: string;
  onPreview: (target: DocumentPreviewTarget) => void;
}) {
  const label = getDocLabel(name);
  const filename = `${name || 'document'}${guessExt(url)}`;
  const downloadUrl = proxyFileUrl(url, filename, false);
  const isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
  const open = () => onPreview({ url, title: label, fileName: filename });

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-background">
      <button type="button" onClick={open} title="Open document" aria-label={`Open ${label}`} className="shrink-0">
        {isImage ? (
          <img src={url} alt={label} className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted grid place-items-center">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </button>
      <button type="button" onClick={open} className="min-w-0 flex-1 text-left" title="Open document">
        <p className="text-sm font-medium text-foreground truncate hover:text-primary" title={label}>{label}</p>
        <p className="text-[11px] text-muted-foreground uppercase">{name}</p>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={open}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
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

/** Name that links to its profile, falling back to plain text when the record carries no user id. */
function UserLink({ user, fallback = 'Unknown' }: { user?: { _id?: string; name?: string }; fallback?: string }) {
  const name = user?.name || fallback;
  if (!user?._id) return <span className="font-medium text-foreground">{name}</span>;
  return (
    <Link to={`/members/${user._id}`} className="font-medium text-foreground hover:text-primary hover:underline">
      {name}
    </Link>
  );
}
