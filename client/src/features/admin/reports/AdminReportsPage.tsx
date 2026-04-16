import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FadeIn, CountUp } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, Users, TrendingUp, TrendingDown, Calendar, BarChart3, Vote, Wrench, Download, FileText, Banknote, Scale, Send, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadTablePdf } from '@/lib/downloadPdf';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { hasMinRole } from '@/lib/roles';
import { formatDate, formatTime } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6'];

type Tab = 'members' | 'finance' | 'events' | 'donations' | 'voting' | 'custom' | 'published';

export default function AdminReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role ? hasMinRole(user.role, UserRole.ADMIN) : false;
  const [tab, setTab] = useState<Tab>('members');

  const allTabs: { key: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { key: 'members', label: 'Members', icon: Users },
    { key: 'finance', label: 'Finance', icon: TrendingUp, adminOnly: true },
    { key: 'events', label: 'Events', icon: Calendar },
    { key: 'donations', label: 'Donations', icon: BarChart3 },
    { key: 'voting', label: 'Voting', icon: Vote },
    { key: 'custom', label: 'Custom Report', icon: Wrench, adminOnly: true },
    { key: 'published', label: 'Published', icon: Send },
  ];

  const tabs = allTabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="container mx-auto space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reports & Analytics</h1>

      <div className="flex flex-col sm:flex-row gap-2 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'members' && <MembersReport />}
      {tab === 'finance' && isAdmin && <FinanceReport />}
      {tab === 'events' && <EventsReport />}
      {tab === 'donations' && <DonationsReport />}
      {tab === 'voting' && <VotingReport />}
      {tab === 'custom' && isAdmin && <CustomReportBuilder />}
      {tab === 'published' && <PublishedReports isAdmin={isAdmin} />}
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

  if (isLoading) return <Spinner size="md" />;

  const { byRole = [], byBatch = [], byDepartment = [], byDistrict = [] } = data?.data || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Role */}
        <FadeIn direction="up" delay={0.1}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Members by Role</h3>
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
                      <span className="ml-auto font-medium text-foreground">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By Batch */}
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Members by Batch</h3>
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
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Members by Department</h3>
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
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Members by District</h3>
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

  if (isLoading) return <Spinner size="md" />;

  const d = data?.data || {};

  const monthlyData = (d.donationsByMonth || [])
    .map((m: any) => ({ name: `${m._id.month}/${m._id.year}`, amount: m.total }))
    .reverse().slice(-12);

  const years = (d.donationsByYear || []).map((y: any) => String(y._id));

  return (
    <div className="space-y-6">
      {/* Year Filter + Summary */}
      <FadeIn direction="up" delay={0.1}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm bg-card text-foreground">
            <option value="">All Years</option>
            {years.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex flex-wrap gap-4">
            <div className="border rounded-lg px-4 py-3 bg-card">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 shrink-0" /> Total Donations</span>
              <p className="text-lg font-bold text-green-600 flex items-center gap-1"><Banknote className="h-4 w-4 shrink-0" /> BDT <CountUp to={d.totalDonations || 0} separator="," duration={1.5} /></p>
            </div>
            <div className="border rounded-lg px-4 py-3 bg-card">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 shrink-0" /> Total Expenses</span>
              <p className="text-lg font-bold text-red-600 flex items-center gap-1"><Banknote className="h-4 w-4 shrink-0" /> BDT <CountUp to={d.totalExpenses || 0} separator="," duration={1.5} /></p>
            </div>
            <div className="border rounded-lg px-4 py-3 bg-card">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3 shrink-0" /> Balance</span>
              <p className={`text-lg font-bold flex items-center gap-1 ${(d.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <Banknote className="h-4 w-4 shrink-0" /> BDT <CountUp to={Math.abs(d.balance || 0)} separator="," duration={1.5} />
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Monthly Donation Trend</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* By Type */}
        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Donations by Type</h3>
            {(d.donationsByType || []).length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={250}>
                  <PieChart>
                    <Pie data={(d.donationsByType || []).map((t: any) => ({ name: t._id, value: t.total }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {(d.donationsByType || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {(d.donationsByType || []).map((t: any, i: number) => (
                    <div key={t._id} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{t._id?.replace('_', ' ')}</span>
                      <span className="ml-auto font-medium text-foreground flex items-center gap-1"><Banknote className="h-3.5 w-3.5 shrink-0" /> BDT {t.total?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        {/* Expenses by Category */}
        <FadeIn direction="up" delay={0.4}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card lg:col-span-2">
            <h3 className="font-semibold text-foreground mb-4">Expenses by Category</h3>
            {(d.expensesByCategory || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(d.expensesByCategory || []).map((c: any) => ({ category: c._id, amount: c.total }))}>
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
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

  if (isLoading) return <Spinner size="md" />;

  const stats = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s: any, i: number) => (
          <FadeIn key={s._id} direction="up" delay={i * 0.06}>
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground capitalize mb-1">{s._id?.replace('_', ' ')}</p>
              <p className="text-2xl font-bold text-foreground"><CountUp to={s.count} duration={1.5} /></p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Avg attendance: {Math.round(s.avgAttendance || 0)}</span>
                <span>Registrations: {s.totalRegistered}</span>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Events Chart */}
      <FadeIn direction="up" delay={0.3}>
        <div className="border rounded-lg p-4 sm:p-6 bg-card">
          <h3 className="font-semibold text-foreground mb-4">Event Participation by Type</h3>
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

  if (isLoading) return <Spinner size="md" />;

  const trends = (data?.data || []).map((t: any) => ({
    name: `${t._id.month}/${t._id.year}`,
    amount: t.total,
    count: t.count,
  }));

  return (
    <div className="space-y-6">
      <FadeIn direction="up" delay={0.1}>
        <div className="border rounded-lg p-4 sm:p-6 bg-card">
          <h3 className="font-semibold text-foreground mb-4">Donation Trends (Amount)</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `BDT ${Number(v).toLocaleString()}`} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </FadeIn>

      <FadeIn direction="up" delay={0.2}>
        <div className="border rounded-lg p-4 sm:p-6 bg-card">
          <h3 className="font-semibold text-foreground mb-4">Donation Count Trend</h3>
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

function VotingReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'voting'],
    queryFn: async () => {
      const { data } = await api.get('/reports/voting');
      return data;
    },
  });

  if (isLoading) return <Spinner size="md" />;

  const { byStatus = [], byEligibility = [] } = data?.data || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {byStatus.map((s: any, i: number) => (
          <FadeIn key={s._id} direction="up" delay={i * 0.06}>
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground capitalize mb-1">{s._id || 'unknown'}</p>
              <p className="text-2xl font-bold text-foreground"><CountUp to={s.count} duration={1.5} /></p>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span>Total voters: {s.totalVoters}</span>
                <span>Avg: {Math.round(s.avgVoters || 0)}</span>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">Votes by Status</h3>
            {byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byStatus.map((s: any) => ({ status: s._id, count: s.count, voters: s.totalVoters }))}>
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Polls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="voters" name="Total Voters" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </FadeIn>

        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg p-4 sm:p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-4">By Eligibility Type</h3>
            {byEligibility.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={250}>
                  <PieChart>
                    <Pie data={byEligibility.map((e: any) => ({ name: e._id?.replace('_', ' '), value: e.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {byEligibility.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {byEligibility.map((e: any, i: number) => (
                    <div key={e._id} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{e._id?.replace('_', ' ')}</span>
                      <span className="ml-auto font-medium text-foreground">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

const SOURCE_FIELDS: Record<string, { label: string; fields: { key: string; label: string }[] }> = {
  users: {
    label: 'Members / Users',
    fields: [
      { key: 'name', label: 'Name' }, { key: 'nameBn', label: 'Name (Bn)' }, { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' }, { key: 'studentId', label: 'Student ID' }, { key: 'registrationNumber', label: 'Reg No.' },
      { key: 'faculty', label: 'Faculty' }, { key: 'department', label: 'Department' }, { key: 'batch', label: 'Batch' },
      { key: 'session', label: 'Session' }, { key: 'homeDistrict', label: 'District' }, { key: 'gender', label: 'Gender' },
      { key: 'bloodGroup', label: 'Blood Group' }, { key: 'profession', label: 'Profession' },
      { key: 'role', label: 'Role' }, { key: 'membershipStatus', label: 'Membership Status' }, { key: 'createdAt', label: 'Joined' },
    ],
  },
  donations: {
    label: 'Donations',
    fields: [
      { key: 'amount', label: 'Amount' }, { key: 'type', label: 'Type' }, { key: 'paymentMethod', label: 'Method' },
      { key: 'paymentStatus', label: 'Status' }, { key: 'transactionId', label: 'TxID' },
      { key: 'senderNumber', label: 'Sender No.' }, { key: 'donorName', label: 'Donor Name' },
      { key: 'receiptNumber', label: 'Receipt No.' }, { key: 'visibility', label: 'Visibility' },
      { key: 'isRecurring', label: 'Recurring' }, { key: 'note', label: 'Note' }, { key: 'createdAt', label: 'Date' },
    ],
  },
  events: {
    label: 'Events',
    fields: [
      { key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start Date' }, { key: 'endDate', label: 'End Date' },
      { key: 'venue', label: 'Venue' }, { key: 'registrationRequired', label: 'Reg Required' },
      { key: 'maxParticipants', label: 'Max Participants' }, { key: 'feedbackEnabled', label: 'Feedback' },
      { key: 'createdAt', label: 'Created' },
    ],
  },
  expenses: {
    label: 'Expenses',
    fields: [
      { key: 'title', label: 'Title' }, { key: 'amount', label: 'Amount' }, { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' }, { key: 'receiptUrl', label: 'Receipt URL' },
      { key: 'createdAt', label: 'Date' },
    ],
  },
};

function CustomReportBuilder() {
  const [source, setSource] = useState('users');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['name', 'email', 'department', 'batch', 'role']));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [maxRows, setMaxRows] = useState('1000');
  const [result, setResult] = useState<any>(null);

  const availableFields = SOURCE_FIELDS[source]?.fields || [];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const filters: any = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (filterRole) filters.role = filterRole;
      if (filterStatus) {
        if (source === 'users') filters.membershipStatus = filterStatus;
        else filters.status = filterStatus;
      }
      if (filterType) filters.type = filterType;

      const { data } = await api.post('/reports/custom', {
        source,
        fields: [...selectedFields],
        filters,
        sortBy: sortBy || undefined,
        sortOrder,
        limit: parseInt(maxRows, 10) || 1000,
      });
      return data.data;
    },
    onSuccess: (data) => setResult(data),
  });

  const toggleField = (key: string) => {
    const next = new Set(selectedFields);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedFields(next);
  };

  const selectAllFields = () => setSelectedFields(new Set(availableFields.map((f) => f.key)));
  const clearAllFields = () => setSelectedFields(new Set());

  const handleSourceChange = (s: string) => {
    setSource(s);
    const defaults = SOURCE_FIELDS[s]?.fields.slice(0, 5).map((f) => f.key) || [];
    setSelectedFields(new Set(defaults));
    setResult(null);
    setFilterRole('');
    setFilterStatus('');
    setFilterType('');
  };

  const downloadCsv = () => {
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RDSWA-${source}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!result?.csv) return;
    await downloadTablePdf(result.csv, `${SOURCE_FIELDS[source]?.label || source} Report`, `RDSWA-${source}-report`);
  };

  return (
    <div className="space-y-6">
      {/* Source Selection */}
      <FadeIn direction="up" delay={0.1}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-3">1. Select Data Source</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SOURCE_FIELDS).map(([key, { label }]) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSourceChange(key)}
                className={`px-4 py-2 text-sm rounded-lg border font-medium transition-colors ${
                  source === key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                }`}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Field Selection */}
      <FadeIn direction="up" delay={0.2}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">2. Select Fields</h3>
            <div className="flex gap-2">
              <button onClick={selectAllFields} className="text-xs text-primary hover:underline">Select All</button>
              <button onClick={clearAllFields} className="text-xs text-muted-foreground hover:underline">Clear</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableFields.map((f) => (
              <label
                key={f.key}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border cursor-pointer transition-colors ${
                  selectedFields.has(f.key) ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'hover:bg-accent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(f.key)}
                  onChange={() => toggleField(f.key)}
                  className="rounded"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn direction="up" delay={0.3}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-3">3. Filters (optional)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-md bg-background text-sm" />
            </div>
            {source === 'users' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Role</label>
                <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-md bg-background text-sm">
                  <option value="">All Roles</option>
                  <option value="user">User</option>
                  <option value="member">Member</option>
                  <option value="alumni">Alumni</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
            {source === 'users' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Membership Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-md bg-background text-sm">
                  <option value="">All</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}
            {(source === 'events' || source === 'donations') && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-md bg-background text-sm">
                  <option value="">All</option>
                  {source === 'events' && <>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </>}
                  {source === 'donations' && <>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </>}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-md bg-background text-sm">
                <option value="">Default</option>
                {availableFields.filter((f) => selectedFields.has(f.key)).map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Order</label>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-1.5 border rounded-md bg-background text-sm">
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Rows</label>
              <input type="number" value={maxRows} onChange={(e) => setMaxRows(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-md bg-background text-sm" min="1" max="5000" />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Generate Button */}
      <FadeIn direction="up" delay={0.4}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => generateMutation.mutate()}
          disabled={selectedFields.size === 0 || generateMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          Generate Report
        </motion.button>
      </FadeIn>

      {/* Results */}
      {result && (
        <FadeIn direction="up" delay={0.1}>
          <div className="border rounded-lg p-4 sm:p-5 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">
                Results — {result.totalRows} records from {SOURCE_FIELDS[source]?.label}
              </h3>
              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={downloadCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent">
                  <Download className="h-3.5 w-3.5" /> CSV
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={downloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </motion.button>
              </div>
            </div>

            {result.data?.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="sticky top-0">
                    <tr className="bg-muted border-b">
                      {result.fields.map((f: string) => (
                        <th key={f} className="text-left p-2 font-medium text-foreground whitespace-nowrap">
                          {availableFields.find((af) => af.key === f)?.label || f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.slice(0, 100).map((row: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-accent/30">
                        {result.fields.map((f: string) => {
                          let val = row[f];
                          if (val === null || val === undefined) val = '';
                          else if (Array.isArray(val)) val = val.join(', ');
                          else if (typeof val === 'object') val = JSON.stringify(val);
                          else if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
                          else val = String(val);
                          // Format dates
                          if (f.includes('Date') || f === 'createdAt' || f === 'startDate' || f === 'endDate') {
                            try { val = val ? formatDate(val) : ''; } catch {}
                          }
                          return <td key={f} className="p-2 text-muted-foreground max-w-[200px] truncate">{val}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.data.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing first 100 rows in preview. Download CSV/PDF for full data ({result.totalRows} rows).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">No records found matching your criteria</p>
            )}
          </div>
        </FadeIn>
      )}
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

/** Publish report snapshots + approval workflow. Draft → Admin approves → Published. */
function PublishedReports({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'finance', fiscalYear: String(new Date().getFullYear()) });

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'published'],
    queryFn: async () => {
      const { data } = await api.get('/reports/published');
      return data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      // Include a lightweight snapshot of the selected report type so viewers see
      // what was published at this moment in time.
      let snapshot: any = {};
      try {
        if (form.type === 'finance') {
          const { data } = await api.get(`/reports/finance?year=${form.fiscalYear}`);
          snapshot = data.data;
        } else if (form.type === 'members') {
          const { data } = await api.get('/reports/members');
          snapshot = data.data;
        } else if (form.type === 'events') {
          const { data } = await api.get('/reports/events');
          snapshot = data.data;
        } else if (form.type === 'donations') {
          const { data } = await api.get('/reports/donations');
          snapshot = data.data;
        }
      } catch {
        /* snapshot is best-effort — proceed even if fetch fails */
      }
      const { data } = await api.post('/reports/publish', {
        title: form.title.trim(),
        type: form.type,
        fiscalYear: form.fiscalYear,
        data: snapshot,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'published'] });
      setShowForm(false);
      setForm({ title: '', type: 'finance', fiscalYear: String(new Date().getFullYear()) });
      toast.success('Draft report created');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create draft'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/reports/publish/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', 'published'] });
      toast.success('Report published');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to approve'),
  });

  const reports = data?.data || [];

  return (
    <FadeIn delay={0.05} direction="up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Published Reports</p>
          <p className="text-xs text-muted-foreground">
            Snapshot reports saved for the record. Drafts require Admin or President/GS approval.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Send className="h-3.5 w-3.5" /> New Draft
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.title.trim()) {
                  toast.error('Title required');
                  return;
                }
                publishMutation.mutate();
              }}
              className="border rounded-lg p-4 bg-card mb-4 space-y-3"
            >
              <div>
                <label className="text-xs text-muted-foreground">Report title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Annual Finance Report FY 2026"
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                  >
                    <option value="finance">Finance</option>
                    <option value="members">Members</option>
                    <option value="events">Events</option>
                    <option value="donations">Donations</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fiscal year</label>
                  <input
                    value={form.fiscalYear}
                    onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={publishMutation.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  {publishMutation.isPending ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 border rounded-md text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="sm" />
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No published reports yet.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r: any, i: number) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="border rounded-lg p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                    r.status === 'published'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                    {r.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  FY {r.fiscalYear || '—'} · Created {formatDate(r.createdAt)}
                  {r.publishedAt && ` · Published ${formatDate(r.publishedAt)} ${formatTime(r.publishedAt)}`}
                </p>
              </div>
              {r.status === 'draft' && (
                <button
                  onClick={() => approveMutation.mutate(r._id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 disabled:opacity-50 shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Publish
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </FadeIn>
  );
}
