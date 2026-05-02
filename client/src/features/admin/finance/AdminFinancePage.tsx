import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useTabParam } from '@/hooks/useTabParam';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  Banknote, Loader2, CheckCircle, XCircle, TrendingUp, TrendingDown,
  Plus, Download, RotateCcw, MessageSquare, ChevronDown, ChevronUp,
  Pencil, Trash2, Calendar,
} from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#16a34a', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

type FinanceTab = 'donations' | 'expenses' | 'campaigns' | 'events';
const FINANCE_TABS: readonly FinanceTab[] = ['donations', 'expenses', 'campaigns', 'events'];

export default function AdminFinancePage() {
  const [tab, setTab] = useTabParam<FinanceTab>(FINANCE_TABS, 'donations');
  const [yearFilter, setYearFilter] = useState<string>('');

  const { data: reportData } = useQuery({
    queryKey: ['reports', 'finance', yearFilter],
    queryFn: async () => {
      const params = yearFilter ? `?year=${yearFilter}` : '';
      const { data } = await api.get(`/reports/finance${params}`);
      return data;
    },
  });

  const report = reportData?.data;

  // Build chart data
  const monthlyChartData = (report?.donationsByMonth || [])
    .map((m: any) => ({
      name: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
      donations: m.total,
      count: m.count,
    }))
    .reverse();

  const typeChartData = (report?.donationsByType || []).map((t: any) => ({
    name: t._id || 'Other',
    value: t.total,
  }));

  const expenseCategoryData = (report?.expensesByCategory || []).map((c: any) => ({
    name: c._id || 'Other',
    value: c.total,
  }));

  const yearOptions = (report?.donationsByYear || []).map((y: any) => y._id);

  const summaryCards = [
    {
      label: 'Total Donations',
      value: `BDT ${(report?.totalDonations || 0).toLocaleString()}`,
      icon: TrendingUp,
      iconColor: 'text-green-600',
      valueColor: 'text-green-600',
    },
    {
      label: 'Total Expenses',
      value: `BDT ${(report?.totalExpenses || 0).toLocaleString()}`,
      icon: TrendingDown,
      iconColor: 'text-red-600',
      valueColor: 'text-red-600',
    },
    {
      label: 'Balance',
      value: `BDT ${(report?.balance || 0).toLocaleString()}`,
      icon: Banknote,
      iconColor: 'text-primary',
      valueColor: (report?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  const exportCSV = (type: 'donations' | 'expenses') => {
    const params = yearFilter ? `&year=${yearFilter}` : '';
    window.open(`${api.defaults.baseURL}/reports/finance/export?type=${type}${params}`, '_blank');
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Finance</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
          >
            <option value="">All Years</option>
            {yearOptions.map((y: number) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => exportCSV('donations')}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Donations CSV
          </button>
          <button
            onClick={() => exportCSV('expenses')}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Expenses CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <FadeIn key={card.label} direction="up" delay={i * 0.06}>
              <div
                className="border rounded-lg p-4 sm:p-6 bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <FadeIn delay={0.1} direction="up">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="text-sm font-medium text-foreground mb-3">Monthly Donations</h3>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="donations" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No data</p>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.15} direction="up">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="text-sm font-medium text-foreground mb-3">Donations by Type</h3>
            {typeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {typeChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No data</p>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.2} direction="up">
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="text-sm font-medium text-foreground mb-3">Expenses by Category</h3>
            {expenseCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={expenseCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {expenseCategoryData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No data</p>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 border-b overflow-x-auto">
        {(['donations', 'expenses', 'campaigns', 'events'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'events' ? 'Event P&L' : t}
          </button>
        ))}
      </div>

      <FadeIn key={tab} direction="up" duration={0.4}>
        {tab === 'donations' && <DonationsList />}
        {tab === 'expenses' && <ExpensesList />}
        {tab === 'campaigns' && <CampaignsList />}
        {tab === 'events' && <EventFinanceList />}
      </FadeIn>
    </div>
  );
}

function DonationsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: string } | null>(null);
  const [donationType, setDonationType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'admin', donationType],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (donationType) params.set('type', donationType);
      const { data } = await api.get(`/donations?${params}`);
      return data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/donations/${id}/verify`, { paymentStatus: status, revisionNote: note }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setActionTarget(null);
      setRevisionNote('');
      toast.success(variables.status === 'completed' ? 'Donation verified' : variables.status === 'failed' ? 'Donation rejected' : 'Revision requested');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Verification failed'); },
  });

  const donations = data?.data || [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: '', label: 'All Types' },
          { key: 'one-time', label: 'One-time' },
          { key: 'monthly', label: 'Monthly' },
          { key: 'membership', label: 'Membership' },
          { key: 'event-based', label: 'Event-based' },
          { key: 'construction-fund', label: 'Construction Fund' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setDonationType(t.key)}
            className={`px-3 py-1.5 text-sm rounded-md border ${
              donationType === t.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {(() => {
        const renderStatusBadge = (d: any) => (
          <span className={`px-2 py-0.5 rounded-full text-xs capitalize whitespace-nowrap ${
            d.paymentStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : d.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : d.paymentStatus === 'revision' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>{d.paymentStatus}</span>
        );
        const renderActionButtons = (d: any, isExpanded: boolean, isActionOpen: boolean) => (
          <div className="flex items-center gap-1 flex-wrap">
            {(d.paymentStatus === 'pending' || d.paymentStatus === 'revision') && (
              <>
                <button
                  onClick={() => verifyMutation.mutate({ id: d._id, status: 'completed' })}
                  className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                  title="Accept"
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({ title: 'Reject Donation', message: `Reject donation of ${d.amount} from ${d.donorName || 'this donor'}?`, confirmLabel: 'Reject', variant: 'danger' });
                    if (ok) verifyMutation.mutate({ id: d._id, status: 'failed' });
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  title="Reject"
                >
                  <XCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActionTarget(isActionOpen ? null : { id: d._id, action: 'revision' })}
                  className="p-1.5 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded"
                  title="Request Revision"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : d._id)}
              className="p-1.5 text-muted-foreground hover:bg-accent rounded"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        );
        const renderRevisionForm = (d: any) => (
          <div className="mt-2">
            <textarea
              placeholder="Revision note for donor..."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 border rounded text-xs bg-card text-foreground"
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => verifyMutation.mutate({ id: d._id, status: 'revision', note: revisionNote })}
                disabled={verifyMutation.isPending}
                className="px-2 py-1 bg-orange-600 text-white rounded text-xs disabled:opacity-50"
              >
                <MessageSquare className="h-3 w-3 inline mr-1" />
                Send Revision
              </button>
              <button
                onClick={() => { setActionTarget(null); setRevisionNote(''); }}
                className="px-2 py-1 border rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        );
        const renderDetails = (d: any) => (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Type: <span className="capitalize">{d.type?.replace('-', ' ')}</span></p>
            <p>Visibility: {d.visibility}</p>
            {d.receiptNumber && <p className="break-all">Receipt: {d.receiptNumber}</p>}
            {d.note && <p className="break-words">Note: {d.note}</p>}
            {d.isRecurring && <p>Recurring: {d.recurringInterval}</p>}
            {d.revisionNote && <p className="text-orange-600 break-words">Revision note: {d.revisionNote}</p>}
            {d.campaign && <p className="break-words">Campaign: {d.campaign?.title || d.campaign}</p>}
            {d.verifiedBy && <p className="break-words">Verified by: {d.verifiedBy?.name || d.verifiedBy}</p>}
          </div>
        );

        return (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[20%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead><tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium text-foreground">Donor</th>
                  <th className="text-left p-3 font-medium text-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-foreground">Method</th>
                  <th className="text-left p-3 font-medium text-foreground">TxID / Sender</th>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-foreground">Date</th>
                  <th className="text-left p-3 font-medium text-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {donations.map((d: any) => {
                    const isExpanded = expandedId === d._id;
                    const isActionOpen = actionTarget?.id === d._id;
                    return (
                      <motion.tr
                        key={d._id}
                        layout
                        className="border-t hover:bg-accent/30 align-top"
                      >
                        <td className="p-3">
                          <p className="text-foreground truncate" title={d.donor?.name || d.donorName || 'Anonymous'}>{d.donor?.name || d.donorName || 'Anonymous'}</p>
                          <p className="text-xs text-muted-foreground truncate" title={d.donor?.email || d.donorEmail || ''}>{d.donor?.email || d.donorEmail || ''}</p>
                        </td>
                        <td className="p-3 font-medium text-foreground whitespace-nowrap">BDT {d.amount?.toLocaleString()}</td>
                        <td className="p-3 capitalize text-xs text-muted-foreground truncate" title={d.paymentMethod}>{d.paymentMethod}</td>
                        <td className="p-3 text-xs text-muted-foreground min-w-0">
                          {d.transactionId && <p className="truncate" title={d.transactionId}>TxID: {d.transactionId}</p>}
                          {d.senderNumber && <p className="truncate" title={d.senderNumber}>Sender: {d.senderNumber}</p>}
                        </td>
                        <td className="p-3">{renderStatusBadge(d)}</td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.createdAt)}</td>
                        <td className="p-3">
                          {renderActionButtons(d, isExpanded, isActionOpen)}
                          <AnimatePresence>
                            {isActionOpen && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                {renderRevisionForm(d)}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                                {renderDetails(d)}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden space-y-3">
              {donations.map((d: any) => {
                const isExpanded = expandedId === d._id;
                const isActionOpen = actionTarget?.id === d._id;
                return (
                  <motion.div key={d._id} layout className="border rounded-lg p-4 bg-card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground font-medium break-words">{d.donor?.name || d.donorName || 'Anonymous'}</p>
                        {(d.donor?.email || d.donorEmail) && (
                          <p className="text-xs text-muted-foreground break-all">{d.donor?.email || d.donorEmail}</p>
                        )}
                        <p className="text-lg font-semibold text-foreground mt-1">BDT {d.amount?.toLocaleString()}</p>
                      </div>
                      {renderStatusBadge(d)}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-0.5 bg-muted rounded-full capitalize">{d.paymentMethod}</span>
                      <span>{formatDate(d.createdAt)}</span>
                    </div>
                    {(d.transactionId || d.senderNumber) && (
                      <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                        {d.transactionId && <p className="break-all"><span className="font-medium">TxID:</span> {d.transactionId}</p>}
                        {d.senderNumber && <p className="break-all"><span className="font-medium">Sender:</span> {d.senderNumber}</p>}
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      {renderActionButtons(d, isExpanded, isActionOpen)}
                    </div>
                    <AnimatePresence>
                      {isActionOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          {renderRevisionForm(d)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                          {renderDetails(d)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

function ExpensesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await api.get('/expenses?limit=50');
      return data;
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', amount: '', category: 'other', description: '' });
    setErrors({});
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, amount: Number(form.amount) };
      if (editId) return (await api.patch(`/expenses/${editId}`, payload)).data;
      return (await api.post('/expenses', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success(editId ? 'Expense updated' : 'Expense added');
      resetForm();
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save expense'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Expense deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete expense'),
  });

  const startEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      title: e.title || '',
      amount: String(e.amount || ''),
      category: e.category || 'other',
      description: e.description || '',
    });
    setErrors({});
    setShowForm(true);
  };

  const expenses = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border rounded-lg p-4 sm:p-6 bg-card mb-4"
          >
            <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Expense title is required'; if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Valid amount is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
              <div>
                <input placeholder="Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                  className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                <FieldError message={errors.title} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErrors((prev) => { const { amount, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.amount ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.amount} />
                </div>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                  <option value="event">Event</option>
                  <option value="office">Office</option>
                  <option value="transport">Transport</option>
                  <option value="food">Food</option>
                  <option value="printing">Printing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <RichTextEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Description..." minHeight="80px" />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {(() => {
            const renderActions = (e: any) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => startEdit(e)}
                  className="p-1.5 hover:bg-accent rounded"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete Expense',
                      message: `Delete "${e.title}"? This action cannot be undone.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                    });
                    if (ok) deleteMutation.mutate(e._id);
                  }}
                  className="p-1.5 hover:bg-destructive/10 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            );

            return (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[18%]" />
                      <col className="w-[14%]" />
                      <col className="w-[18%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead><tr className="bg-muted border-b">
                      <th className="text-left p-3 font-medium text-foreground">Title</th>
                      <th className="text-left p-3 font-medium text-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-foreground">Category</th>
                      <th className="text-left p-3 font-medium text-foreground">Date</th>
                      <th className="text-right p-3 font-medium text-foreground">Actions</th>
                    </tr></thead>
                    <tbody>
                      {expenses.map((e: any) => (
                        <tr key={e._id} className="border-t hover:bg-accent/30">
                          <td className="p-3 text-foreground truncate" title={e.title}>{e.title}</td>
                          <td className="p-3 font-medium text-red-600 whitespace-nowrap">BDT {e.amount?.toLocaleString()}</td>
                          <td className="p-3 capitalize text-xs text-muted-foreground truncate" title={e.category}>{e.category}</td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</td>
                          <td className="p-3">{renderActions(e)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="lg:hidden space-y-3">
                  {expenses.map((e: any) => (
                    <div key={e._id} className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-foreground font-medium break-words flex-1 min-w-0">{e.title}</p>
                        <p className="font-semibold text-red-600 whitespace-nowrap shrink-0">BDT {e.amount?.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                        <span className="px-2 py-0.5 bg-muted rounded-full capitalize">{e.category}</span>
                        <span>{formatDate(e.createdAt)}</span>
                      </div>
                      <div className="pt-2 border-t">{renderActions(e)}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

function CampaignsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetAmount: '', startDate: '', endDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'campaigns'],
    queryFn: async () => {
      const { data } = await api.get('/donations/campaigns');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/donations/campaigns', { ...form, targetAmount: Number(form.targetAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations', 'campaigns'] });
      setShowForm(false);
      toast.success('Campaign created');
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to create campaign'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/donations/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations', 'campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete campaign'),
  });

  const campaigns = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border rounded-lg p-4 sm:p-6 bg-card mb-4"
          >
            <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Campaign title is required'; if (!form.targetAmount || Number(form.targetAmount) <= 0) errs.targetAmount = 'Valid target amount is required'; if (Object.keys(errs).length) { setErrors(errs); return; } createMutation.mutate(); }} className="space-y-3">
              <div>
                <input placeholder="Campaign Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                  className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                <FieldError message={errors.title} />
              </div>
              <RichTextEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Description..." minHeight="80px" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input type="number" placeholder="Target Amount" value={form.targetAmount} onChange={(e) => { setForm({ ...form, targetAmount: e.target.value }); setErrors((prev) => { const { targetAmount, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.targetAmount ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.targetAmount} />
                </div>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  Create
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any, i: number) => (
            <FadeIn key={c._id} direction="up" delay={i * 0.06}>
              <div
                className="border rounded-lg p-4 sm:p-6 bg-card"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground">{c.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{c.status}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-semibold text-foreground flex items-center gap-1 text-sm"><Banknote className="h-4 w-4 shrink-0" /> BDT {c.raisedAmount?.toLocaleString()} / {c.targetAmount?.toLocaleString()}</p>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete Campaign',
                          message: `Delete "${c.title}"? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          variant: 'danger',
                        });
                        if (ok) deleteMutation.mutate(c._id);
                      }}
                      className="p-1.5 hover:bg-destructive/10 rounded"
                      title="Delete campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(100, (c.raisedAmount / c.targetAmount) * 100)}%` }} />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-event financial report: budget vs actual expense. */
function EventFinanceList() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'finance', 'events'],
    queryFn: async () => {
      const { data } = await api.get('/reports/finance/events');
      return data;
    },
  });

  const events: any[] = data?.data || [];

  if (isLoading) {
    return <Spinner size="sm" />;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
        No event-linked budgets or expenses yet.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block border rounded-lg overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[16%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted border-b">
              <th className="text-left p-3 font-medium text-foreground">Event</th>
              <th className="text-right p-3 font-medium text-foreground">Budget</th>
              <th className="text-right p-3 font-medium text-foreground">Actual Expense</th>
              <th className="text-right p-3 font-medium text-foreground">Variance</th>
              <th className="text-left p-3 font-medium text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e: any, i: number) => {
              const budget = e.totalBudget || 0;
              const actual = e.totalExpense || 0;
              const variance = budget - actual;
              const overBudget = variance < 0;
              return (
                <motion.tr
                  key={e._id || i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-t hover:bg-accent/30"
                >
                  <td className="p-3 text-foreground">
                    <p className="truncate" title={e.eventTitle || 'Unknown event'}>{e.eventTitle || 'Unknown event'}</p>
                    {e.eventDate && (
                      <p className="text-[11px] text-muted-foreground">{formatDate(e.eventDate)}</p>
                    )}
                  </td>
                  <td className="p-3 text-right text-foreground whitespace-nowrap">BDT {budget.toLocaleString()}</td>
                  <td className="p-3 text-right text-red-600 font-medium whitespace-nowrap">BDT {actual.toLocaleString()}</td>
                  <td className={`p-3 text-right font-medium whitespace-nowrap ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                    {overBudget ? '−' : '+'} BDT {Math.abs(variance).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs">
                    {e.status ? (
                      <span className="px-2 py-0.5 rounded-full bg-muted capitalize text-muted-foreground whitespace-nowrap">{e.status}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="lg:hidden space-y-3">
        {events.map((e: any, i: number) => {
          const budget = e.totalBudget || 0;
          const actual = e.totalExpense || 0;
          const variance = budget - actual;
          const overBudget = variance < 0;
          return (
            <motion.div
              key={e._id || i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border rounded-lg p-4 bg-card"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium break-words">{e.eventTitle || 'Unknown event'}</p>
                  {e.eventDate && (
                    <p className="text-xs text-muted-foreground">{formatDate(e.eventDate)}</p>
                  )}
                </div>
                {e.status && (
                  <span className="px-2 py-0.5 rounded-full bg-muted capitalize text-muted-foreground text-xs whitespace-nowrap shrink-0">{e.status}</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Budget</p>
                  <p className="font-medium text-foreground">BDT {budget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual</p>
                  <p className="font-medium text-red-600">BDT {actual.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Variance</p>
                  <p className={`font-medium ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                    {overBudget ? '−' : '+'} BDT {Math.abs(variance).toLocaleString()}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
