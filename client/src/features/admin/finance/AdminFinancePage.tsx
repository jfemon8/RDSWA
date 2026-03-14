import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import {
  DollarSign, Loader2, CheckCircle, XCircle, TrendingUp, TrendingDown,
  Plus, Download, RotateCcw, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#2563eb', '#16a34a', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function AdminFinancePage() {
  const [tab, setTab] = useState<'donations' | 'expenses' | 'campaigns'>('donations');
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
      value: `৳${(report?.totalDonations || 0).toLocaleString()}`,
      icon: TrendingUp,
      iconColor: 'text-green-600',
      valueColor: 'text-green-600',
    },
    {
      label: 'Total Expenses',
      value: `৳${(report?.totalExpenses || 0).toLocaleString()}`,
      icon: TrendingDown,
      iconColor: 'text-red-600',
      valueColor: 'text-red-600',
    },
    {
      label: 'Balance',
      value: `৳${(report?.balance || 0).toLocaleString()}`,
      icon: DollarSign,
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
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
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
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
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
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
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
      <div className="flex flex-col sm:flex-row gap-2 mb-6 border-b">
        {(['donations', 'expenses', 'campaigns'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <FadeIn key={tab} direction="up" duration={0.4}>
        {tab === 'donations' && <DonationsList />}
        {tab === 'expenses' && <ExpensesList />}
        {tab === 'campaigns' && <CampaignsList />}
      </FadeIn>
    </div>
  );
}

function DonationsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'admin'],
    queryFn: async () => {
      const { data } = await api.get('/donations?limit=50');
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
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full min-w-[600px] text-sm">
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
                  <p className="text-foreground">{d.donor?.name || d.donorName || 'Anonymous'}</p>
                  <p className="text-xs text-muted-foreground">{d.donor?.email || d.donorEmail || ''}</p>
                </td>
                <td className="p-3 font-medium text-foreground">৳{d.amount?.toLocaleString()}</td>
                <td className="p-3 capitalize text-xs text-muted-foreground">{d.paymentMethod}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {d.transactionId && <p>TxID: {d.transactionId}</p>}
                  {d.senderNumber && <p>Sender: {d.senderNumber}</p>}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                    d.paymentStatus === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : d.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : d.paymentStatus === 'revision' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>{d.paymentStatus}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{formatDate(d.createdAt)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
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
                          onClick={() => verifyMutation.mutate({ id: d._id, status: 'failed' })}
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

                  {/* Revision note form */}
                  <AnimatePresence>
                    {isActionOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 text-xs text-muted-foreground space-y-1"
                      >
                        <p>Type: <span className="capitalize">{d.type?.replace('-', ' ')}</span></p>
                        <p>Visibility: {d.visibility}</p>
                        {d.receiptNumber && <p>Receipt: {d.receiptNumber}</p>}
                        {d.note && <p>Note: {d.note}</p>}
                        {d.isRecurring && <p>Recurring: {d.recurringInterval}</p>}
                        {d.revisionNote && <p className="text-orange-600">Revision note: {d.revisionNote}</p>}
                        {d.campaign && <p>Campaign: {d.campaign?.title || d.campaign}</p>}
                        {d.verifiedBy && <p>Verified by: {d.verifiedBy?.name || d.verifiedBy}</p>}
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
  );
}

function ExpensesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data } = await api.get('/expenses?limit=50');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/expenses', { ...form, amount: Number(form.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setShowForm(false);
      setForm({ title: '', amount: '', category: 'other', description: '' });
      toast.success('Expense added');
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to add expense'); } },
  });

  const expenses = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
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
            <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Expense title is required'; if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Valid amount is required'; if (Object.keys(errs).length) { setErrors(errs); return; } createMutation.mutate(); }} className="space-y-3">
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
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  Add
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
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="bg-muted border-b">
              <th className="text-left p-3 font-medium text-foreground">Title</th>
              <th className="text-left p-3 font-medium text-foreground">Amount</th>
              <th className="text-left p-3 font-medium text-foreground">Category</th>
              <th className="text-left p-3 font-medium text-foreground">Date</th>
            </tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr
                  key={e._id}
                  className="border-t hover:bg-accent/30"
                >
                  <td className="p-3 text-foreground">{e.title}</td>
                  <td className="p-3 font-medium text-red-600">৳{e.amount?.toLocaleString()}</td>
                  <td className="p-3 capitalize text-xs text-muted-foreground">{e.category}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CampaignsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
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
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
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
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-foreground">{c.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{c.status}</p>
                  </div>
                  <p className="font-semibold text-foreground">৳{c.raisedAmount?.toLocaleString()} / ৳{c.targetAmount?.toLocaleString()}</p>
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
