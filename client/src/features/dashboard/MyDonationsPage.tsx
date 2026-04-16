import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { Receipt, RefreshCw, Download, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { downloadHtmlPdf } from '@/lib/downloadPdf';
import { useState } from 'react';
import Spinner from '@/components/ui/Spinner';

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Pending' },
  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
  refunded: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Refunded' },
  revision: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Revision Required' },
};

export default function MyDonationsPage() {
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'my'],
    queryFn: async () => {
      const { data } = await api.get('/donations/my');
      return data;
    },
  });

  const donations = data?.data || [];
  const filtered = filter === 'all' ? donations : donations.filter((d: any) => d.paymentStatus === filter);

  const statusCounts = donations.reduce((acc: Record<string, number>, d: any) => {
    acc[d.paymentStatus] = (acc[d.paymentStatus] || 0) + 1;
    return acc;
  }, {});

  const downloadReceipt = async (id: string) => {
    const { data } = await api.get(`/donations/${id}/receipt`, { responseType: 'text' });
    await downloadHtmlPdf(data, 'RDSWA-Donation-Receipt');
  };

  return (
    <div className="container mx-auto">
      <BlurText
        text="My Donations"
        className="text-2xl md:text-3xl font-bold mb-6"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {/* Summary cards */}
      <div className="grid grid-equal grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <FadeIn delay={0} direction="up">
          <button
            onClick={() => setFilter('all')}
            className={`border rounded-lg p-3 text-left w-full transition-colors ${filter === 'all' ? 'border-primary bg-primary/5' : ''}`}
          >
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{donations.length}</p>
          </button>
        </FadeIn>
        {Object.entries(statusConfig).map(([key, cfg], i) => (
          <FadeIn key={key} delay={(i + 1) * 0.05} direction="up">
            <button
              onClick={() => setFilter(key)}
              className={`border rounded-lg p-3 text-left w-full transition-colors ${filter === key ? 'border-primary bg-primary/5' : ''}`}
            >
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className={`text-xl font-bold ${cfg.color}`}>{statusCounts[key] || 0}</p>
            </button>
          </FadeIn>
        ))}
      </div>

      {/* Donations list */}
      {isLoading ? (
        <Spinner size="md" />
      ) : filtered.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No donations found</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((d: any, index: number) => {
              const status = statusConfig[d.paymentStatus] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={d._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div
                    className="border rounded-lg p-4 bg-background"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          {d.isRecurring && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                              <RefreshCw className="h-3 w-3" />
                              {d.recurringInterval}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground capitalize">{d.type?.replace('-', ' ')}</span>
                        </div>
                        <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                          <Receipt className="h-4 w-4 text-primary shrink-0" /> BDT {d.amount?.toLocaleString()}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                          <span className="capitalize">{d.paymentMethod}</span>
                          {d.transactionId && <span>TxID: {d.transactionId}</span>}
                          {d.senderNumber && <span>From: {d.senderNumber}</span>}
                          {d.receiptNumber && <span>Receipt: {d.receiptNumber}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(d.createdAt)}
                        </p>
                      </div>

                      {d.paymentStatus === 'completed' && (
                        <button
                          onClick={() => downloadReceipt(d._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-accent"
                          title="Download Receipt"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Receipt
                        </button>
                      )}
                    </div>

                    {/* Revision note */}
                    <AnimatePresence>
                      {d.paymentStatus === 'revision' && d.revisionNote && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-200 text-sm text-orange-800"
                        >
                          <p className="font-medium text-xs mb-1">Revision Note:</p>
                          {d.revisionNote}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Recurring info */}
                    {d.isRecurring && d.nextPaymentDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Next payment: {formatDate(d.nextPaymentDate)}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
