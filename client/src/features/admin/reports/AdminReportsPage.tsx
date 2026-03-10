import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn, CountUp } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6'];

type Tab = 'members' | 'finance' | 'events' | 'donations';

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('members');

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'members', label: 'Members', icon: Users },
    { key: 'finance', label: 'Finance', icon: TrendingUp },
    { key: 'events', label: 'Events', icon: Calendar },
    { key: 'donations', label: 'Donations', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>

      <div className="flex gap-2 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </motion.button>
          );
        })}
      </div>

      {tab === 'members' && <MembersReport />}
      {tab === 'finance' && <FinanceReport />}
      {tab === 'events' && <EventsReport />}
      {tab === 'donations' && <DonationsReport />}
    </div>
  );
}

function MembersReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'members'],
    queryFn: async () => {
      const { data } = await api.get('/reports/members');
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { byRole = [], byBatch = [], byDepartment = [], byDistrict = [] } = data?.data || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Role */}
        <FadeIn direction="up" delay={0.1}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Members by Role</h3>
            {byRole.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={byRole.map((r: any) => ({ name: r._id, value: r.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                      {byRole.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {byRole.map((r: any, i: number) => (
                    <div key={r._id} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{r._id?.replace('_', ' ')}</span>
                      <span className="ml-auto font-medium">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By Batch */}
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Members by Batch</h3>
            {byBatch.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byBatch.map((b: any) => ({ batch: b._id, count: b.count }))}>
                  <XAxis dataKey="batch" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By Department */}
        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Members by Department</h3>
            {byDepartment.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDepartment.slice(0, 10).map((d: any) => ({ dept: d._id, count: d.count }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By District */}
        <FadeIn direction="up" delay={0.4}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Members by District</h3>
            {byDistrict.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDistrict.slice(0, 10).map((d: any) => ({ district: d._id, count: d.count }))} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="district" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function FinanceReport() {
  const [year, setYear] = useState<string>('');
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'finance', year],
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const { data } = await api.get(`/reports/finance${params}`);
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const d = data?.data || {};

  const monthlyData = (d.donationsByMonth || [])
    .map((m: any) => ({ name: `${m._id.month}/${m._id.year}`, amount: m.total }))
    .reverse().slice(-12);

  const years = (d.donationsByYear || []).map((y: any) => String(y._id));

  return (
    <div className="space-y-6">
      {/* Year Filter + Summary */}
      <FadeIn direction="up" delay={0.1}>
        <div className="flex items-center gap-4 flex-wrap">
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm bg-background">
            <option value="">All Years</option>
            {years.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-4">
            <div className="border rounded-lg px-4 py-3 bg-background">
              <span className="text-xs text-muted-foreground">Total Donations</span>
              <p className="text-lg font-bold text-green-600">৳<CountUp to={d.totalDonations || 0} separator="," duration={1.5} /></p>
            </div>
            <div className="border rounded-lg px-4 py-3 bg-background">
              <span className="text-xs text-muted-foreground">Total Expenses</span>
              <p className="text-lg font-bold text-red-600">৳<CountUp to={d.totalExpenses || 0} separator="," duration={1.5} /></p>
            </div>
            <div className="border rounded-lg px-4 py-3 bg-background">
              <span className="text-xs text-muted-foreground">Balance</span>
              <p className={`text-lg font-bold ${(d.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ৳<CountUp to={Math.abs(d.balance || 0)} separator="," duration={1.5} />
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Monthly Donation Trend</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By Type */}
        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg p-5 bg-background">
            <h3 className="font-semibold mb-4">Donations by Type</h3>
            {(d.donationsByType || []).length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={250}>
                  <PieChart>
                    <Pie data={(d.donationsByType || []).map((t: any) => ({ name: t._id, value: t.total }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {(d.donationsByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {(d.donationsByType || []).map((t: any, i: number) => (
                    <div key={t._id} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{t._id?.replace('_', ' ')}</span>
                      <span className="ml-auto font-medium">৳{t.total?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* Expenses by Category */}
        <FadeIn direction="up" delay={0.4}>
          <div className="border rounded-lg p-5 bg-background lg:col-span-2">
            <h3 className="font-semibold mb-4">Expenses by Category</h3>
            {(d.expensesByCategory || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(d.expensesByCategory || []).map((c: any) => ({ category: c._id, amount: c.total }))}>
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function EventsReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'events'],
    queryFn: async () => {
      const { data } = await api.get('/reports/events');
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const stats = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s: any, i: number) => (
          <FadeIn key={s._id} direction="up" delay={i * 0.06}>
            <motion.div whileHover={{ y: -2 }} className="border rounded-lg p-4 bg-background">
              <p className="text-sm text-muted-foreground capitalize mb-1">{s._id?.replace('_', ' ')}</p>
              <p className="text-2xl font-bold"><CountUp to={s.count} duration={1.5} /></p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Avg attendance: {Math.round(s.avgAttendance || 0)}</span>
                <span>Registrations: {s.totalRegistered}</span>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>

      {/* Events Chart */}
      <FadeIn direction="up" delay={0.3}>
        <div className="border rounded-lg p-5 bg-background">
          <h3 className="font-semibold mb-4">Event Participation by Type</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.map((s: any) => ({
                type: s._id?.replace('_', ' '),
                events: s.count,
                avgAttendance: Math.round(s.avgAttendance || 0),
                registered: s.totalRegistered,
              }))}>
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="events" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgAttendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="registered" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </FadeIn>
    </div>
  );
}

function DonationsReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'donations'],
    queryFn: async () => {
      const { data } = await api.get('/reports/donations');
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const trends = (data?.data || []).map((t: any) => ({
    name: `${t._id.month}/${t._id.year}`,
    amount: t.total,
    count: t.count,
  }));

  return (
    <div className="space-y-6">
      <FadeIn direction="up" delay={0.1}>
        <div className="border rounded-lg p-5 bg-background">
          <h3 className="font-semibold mb-4">Donation Trends (Amount)</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </FadeIn>

      <FadeIn direction="up" delay={0.2}>
        <div className="border rounded-lg p-5 bg-background">
          <h3 className="font-semibold mb-4">Donation Count Trend</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trends}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </FadeIn>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
      No data available
    </div>
  );
}
