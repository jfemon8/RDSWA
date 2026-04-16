import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { Search, CheckCircle, XCircle, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate, formatTime } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';

export default function AdminDonationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    mutationFn: ({ id, paymentStatus, revisionNote }: { id: string; paymentStatus: string; revisionNote?: string }) =>
      api.patch(`/donations/${id}/verify`, { paymentStatus, ...(revisionNote ? { revisionNote } : {}) }),
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
        <Spinner size="md" />
      ) : donations.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No donations found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          {(() => {
            const renderStatus = (d: any) => (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                d.paymentStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : d.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : d.paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  : d.paymentStatus === 'revision' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {d.paymentStatus || 'pending'}
              </span>
            );
            const renderVisibility = (d: any) => (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                d.visibility === 'private'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {d.visibility === 'private' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {d.visibility || 'public'}
              </span>
            );
            const renderActions = (d: any) => (
              <div className="flex gap-1">
                {d.paymentStatus !== 'completed' && (
                  <button onClick={(e) => { e.stopPropagation(); verifyMutation.mutate({ id: d._id, paymentStatus: 'completed' }); }} title="Verify"
                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                    <CheckCircle className="h-4 w-4" />
                  </button>
                )}
                {d.paymentStatus !== 'failed' && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const ok = await confirm({ title: 'Reject Donation', message: `Reject donation of ${d.amount} from ${d.donorName || 'this donor'}?`, confirmLabel: 'Reject', variant: 'danger' });
                    if (ok) verifyMutation.mutate({ id: d._id, paymentStatus: 'failed' });
                  }} title="Reject"
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
                {isSuperAdmin && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const ok = await confirm({ title: 'Delete Donation', message: `Delete this donation record of ${d.amount} from ${d.donorName || 'this donor'}? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                    if (ok) deleteMutation.mutate(d._id);
                  }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
            const renderDetails = (d: any) => (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                {['bkash', 'nagad', 'rocket'].includes(d.paymentMethod) && d.senderNumber && (
                  <div><span className="text-muted-foreground">Sender Number</span><p className="font-medium text-foreground font-mono break-all">{d.senderNumber}</p></div>
                )}
                {d.paymentMethod === 'bank' && (
                  <>
                    {d.senderBankName && <div><span className="text-muted-foreground">Sender Bank</span><p className="font-medium text-foreground break-words">{d.senderBankName}</p></div>}
                    {d.senderAccountNumber && <div><span className="text-muted-foreground">Sender A/C No</span><p className="font-medium text-foreground font-mono break-all">{d.senderAccountNumber}</p></div>}
                  </>
                )}
                {d.paymentMethod === 'cash' && (
                  <>
                    {d.cashDate && <div><span className="text-muted-foreground">Payment Date</span><p className="font-medium text-foreground">{formatDate(d.cashDate)}</p></div>}
                    {d.cashTime && d.cashDate && <div><span className="text-muted-foreground">Payment Time</span><p className="font-medium text-foreground">{formatTime(`${d.cashDate}T${d.cashTime}`)}</p></div>}
                  </>
                )}
                {d.donorEmail && <div><span className="text-muted-foreground">Donor Email</span><p className="font-medium text-foreground break-all">{d.donorEmail}</p></div>}
                {d.donorPhone && <div><span className="text-muted-foreground">Donor Phone</span><p className="font-medium text-foreground break-all">{d.donorPhone}</p></div>}
                {d.receiptNumber && <div><span className="text-muted-foreground">Receipt</span><p className="font-medium text-foreground break-all">{d.receiptNumber}</p></div>}
                {d.type && <div><span className="text-muted-foreground">Type</span><p className="font-medium text-foreground capitalize">{d.type.replace('-', ' ')}</p></div>}
                {d.isRecurring && <div><span className="text-muted-foreground">Recurring</span><p className="font-medium text-foreground capitalize">{d.recurringInterval}</p></div>}
                {d.campaign?.title && <div><span className="text-muted-foreground">Campaign</span><p className="font-medium text-foreground break-words">{d.campaign.title}</p></div>}
                {d.note && <div className="col-span-full"><span className="text-muted-foreground">Note</span><p className="font-medium text-foreground break-words">{d.note}</p></div>}
                {d.revisionNote && <div className="col-span-full"><span className="text-muted-foreground">Revision Note</span><p className="font-medium text-orange-600 dark:text-orange-400 break-words">{d.revisionNote}</p></div>}
              </div>
            );

            return (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                      <col className="w-[11%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-muted border-b">
                        <th className="text-left p-3 font-medium">Donor</th>
                        <th className="text-left p-3 font-medium">Amount</th>
                        <th className="text-left p-3 font-medium">Method</th>
                        <th className="text-left p-3 font-medium">Transaction</th>
                        <th className="text-left p-3 font-medium">Visibility</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    {donations.map((d: any) => (
                      <motion.tbody key={d._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <tr className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setExpandedId(expandedId === d._id ? null : d._id)}>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <motion.span animate={{ rotate: expandedId === d._id ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              </motion.span>
                              {d.donor?._id ? (
                                <Link to={`/members/${d.donor._id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary transition-colors truncate" title={d.donor.name}>{d.donor.name}</Link>
                              ) : (
                                <span className="font-medium truncate" title={d.donorName || 'Anonymous'}>{d.donorName || 'Anonymous'}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-medium whitespace-nowrap">BDT {d.amount}</td>
                          <td className="p-3 text-muted-foreground capitalize truncate" title={d.paymentMethod}>{d.paymentMethod}</td>
                          <td className="p-3 text-xs text-muted-foreground truncate" title={d.transactionId || ''}>{d.transactionId || '-'}</td>
                          <td className="p-3">{renderVisibility(d)}</td>
                          <td className="p-3">{renderStatus(d)}</td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.createdAt)}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>{renderActions(d)}</td>
                        </tr>
                        <AnimatePresence>
                          {expandedId === d._id && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 py-3 bg-muted/50 border-b">{renderDetails(d)}</div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </motion.tbody>
                    ))}
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="lg:hidden space-y-3">
                  {donations.map((d: any) => (
                    <div key={d._id} className="border rounded-lg bg-card overflow-hidden">
                      <div className="p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === d._id ? null : d._id)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            {d.donor?._id ? (
                              <Link to={`/members/${d.donor._id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary transition-colors break-words">{d.donor.name}</Link>
                            ) : (
                              <p className="font-medium break-words">{d.donorName || 'Anonymous'}</p>
                            )}
                            <p className="text-lg font-semibold text-foreground mt-0.5">BDT {d.amount}</p>
                          </div>
                          <motion.span animate={{ rotate: expandedId === d._id ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 mt-1">
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </motion.span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                          <span className="px-2 py-0.5 bg-muted rounded-full capitalize">{d.paymentMethod}</span>
                          {renderStatus(d)}
                          {renderVisibility(d)}
                          <span>{formatDate(d.createdAt)}</span>
                        </div>
                        {d.transactionId && (
                          <p className="text-xs text-muted-foreground break-all mb-3">
                            <span className="font-medium">Txn:</span> {d.transactionId}
                          </p>
                        )}
                        <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          {renderActions(d)}
                        </div>
                      </div>
                      <AnimatePresence>
                        {expandedId === d._id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-muted/50 border-t">{renderDetails(d)}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
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
