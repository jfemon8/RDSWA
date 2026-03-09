import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DollarSign, Loader2, CheckCircle, TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

export default function AdminFinancePage() {
  const [tab, setTab] = useState<'donations' | 'expenses' | 'campaigns'>('donations');

  const { data: reportData } = useQuery({
    queryKey: ['reports', 'finance'],
    queryFn: async () => {
      const { data } = await api.get('/reports/finance');
      return data;
    },
  });

  const report = reportData?.data;

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Finance</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <FadeIn key={card.label} direction="up" delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="border rounded-lg p-5 bg-background"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
              </motion.div>
            </FadeIn>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {(['donations', 'expenses', 'campaigns'] as const).map((t) => (
          <motion.button
            key={t}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </motion.button>
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

  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'admin'],
    queryFn: async () => {
      const { data } = await api.get('/donations?limit=20');
      return data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/donations/${id}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['donations'] }),
  });

  const donations = data?.data || [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead><tr className="bg-muted/50 border-b">
          <th className="text-left p-3 font-medium">Donor</th>
          <th className="text-left p-3 font-medium">Amount</th>
          <th className="text-left p-3 font-medium">Type</th>
          <th className="text-left p-3 font-medium">Payment</th>
          <th className="text-left p-3 font-medium">Status</th>
          <th className="text-left p-3 font-medium">Date</th>
          <th className="text-left p-3 font-medium">Actions</th>
        </tr></thead>
        <tbody>
          {donations.map((d: any) => (
            <motion.tr
              key={d._id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className="border-t hover:bg-accent/30"
            >
              <td className="p-3">{d.donor?.name || d.donorName || 'Anonymous'}</td>
              <td className="p-3 font-medium">৳{d.amount?.toLocaleString()}</td>
              <td className="p-3 capitalize text-xs">{d.type?.replace('-', ' ')}</td>
              <td className="p-3 capitalize text-xs">{d.paymentMethod}</td>
              <td className="p-3">
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                  d.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{d.paymentStatus}</span>
              </td>
              <td className="p-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
              <td className="p-3">
                {d.paymentStatus === 'pending' && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => verifyMutation.mutate(d._id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    title="Verify"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </motion.button>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpensesList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', description: '' });

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
    },
  });

  const expenses = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> Add Expense
        </motion.button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 bg-background mb-4">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm" required />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="event">Event</option>
                <option value="office">Office</option>
                <option value="transport">Transport</option>
                <option value="food">Food</option>
                <option value="printing">Printing</option>
                <option value="other">Other</option>
              </select>
            </div>
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                Add
              </motion.button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50 border-b">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Category</th>
              <th className="text-left p-3 font-medium">Date</th>
            </tr></thead>
            <tbody>
              {expenses.map((e: any) => (
                <motion.tr
                  key={e._id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="border-t"
                >
                  <td className="p-3">{e.title}</td>
                  <td className="p-3 font-medium text-red-600">৳{e.amount?.toLocaleString()}</td>
                  <td className="p-3 capitalize text-xs">{e.category}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</td>
                </motion.tr>
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetAmount: '', startDate: '', endDate: '' });

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
    },
  });

  const campaigns = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> New Campaign
        </motion.button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 bg-background mb-4">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <input placeholder="Campaign Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <input type="number" placeholder="Target Amount" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm" required />
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm" />
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm" />
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                Create
              </motion.button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any, i: number) => (
            <FadeIn key={c._id} direction="up" delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="border rounded-lg p-4 bg-background"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{c.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{c.status}</p>
                  </div>
                  <p className="font-semibold">৳{c.raisedAmount?.toLocaleString()} / ৳{c.targetAmount?.toLocaleString()}</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(100, (c.raisedAmount / c.targetAmount) * 100)}%` }} />
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
