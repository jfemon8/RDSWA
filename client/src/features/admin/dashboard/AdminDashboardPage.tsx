import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Users, Calendar, DollarSign, FileText, Clock, UserCheck, Loader2, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, CountUp } from '@/components/reactbits';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { formatDateCustom } from '@/lib/date';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data;
    },
  });

  // Member analytics for charts
  const { data: memberData } = useQuery({
    queryKey: ['reports', 'members'],
    queryFn: async () => {
      const { data } = await api.get('/reports/members');
      return data;
    },
  });

  // Finance summary for chart
  const { data: financeData } = useQuery({
    queryKey: ['reports', 'finance'],
    queryFn: async () => {
      const { data } = await api.get('/reports/finance');
      return data;
    },
  });

  // Pending members for quick approvals
  const { data: pendingData } = useQuery({
    queryKey: ['users', 'pending'],
    queryFn: async () => {
      const { data } = await api.get('/users?membershipStatus=pending&limit=5');
      return data;
    },
  });

  // Recent audit logs
  const { data: logsData } = useQuery({
    queryKey: ['admin', 'logs', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/admin/logs?limit=8');
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const stats = data?.data;

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', isCurrency: false },
    { label: 'Approved Members', value: stats?.approvedMembers || 0, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', isCurrency: false },
    { label: 'Pending Members', value: stats?.pendingMembers || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', isCurrency: false },
    { label: 'Total Events', value: stats?.totalEvents || 0, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', isCurrency: false },
    { label: 'Total Donations', value: stats?.totalDonationsAmount || 0, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', isCurrency: true },
    { label: 'Pending Forms', value: stats?.pendingForms || 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', isCurrency: false },
  ];

  // Prepare chart data
  const donationMonthly = (financeData?.data?.donationsByMonth || [])
    .map((d: any) => ({
      name: `${d._id.month}/${d._id.year}`,
      amount: d.total,
    }))
    .reverse()
    .slice(-12);

  const memberByRole = (memberData?.data?.byRole || []).map((d: any) => ({
    name: d._id,
    value: d.count,
  }));

  const pendingMembers = pendingData?.data || [];
  const recentLogs = logsData?.data || [];

  return (
    <div className="container mx-auto space-y-6 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <FadeIn key={card.label} direction="up" delay={i * 0.06}>
              <div
                className="border rounded-lg p-4 sm:p-5 bg-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {card.isCurrency ? (
                    <>৳<CountUp to={card.value} separator="," duration={1.5} /></>
                  ) : (
                    <CountUp to={card.value} separator="," duration={1.5} />
                  )}
                </p>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donation Trend Chart */}
        <FadeIn direction="up" delay={0.4}>
          <div className="border rounded-lg p-4 sm:p-5 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-foreground">Donation Trend</h3>
            </div>
            {donationMonthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={donationMonthly}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No donation data yet</div>
            )}
          </div>
        </FadeIn>

        {/* Members by Role Pie */}
        <FadeIn direction="up" delay={0.5}>
          <div className="border rounded-lg p-4 sm:p-5 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-foreground">Members by Role</h3>
            </div>
            {memberByRole.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie data={memberByRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {memberByRole.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {memberByRole.map((r: any, i: number) => (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{r.name}</span>
                      <span className="ml-auto font-medium text-foreground">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No member data yet</div>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Bottom Row: Pending Approvals + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <FadeIn direction="up" delay={0.6}>
          <div className="border rounded-lg p-4 sm:p-5 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-foreground">Pending Approvals</h3>
              </div>
              {(stats?.pendingMembers || 0) > 5 && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className="text-xs text-primary hover:underline"
                >
                  View all ({stats.pendingMembers})
                </button>
              )}
            </div>
            <AnimatePresence mode="popLayout">
              {pendingMembers.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                  No pending approvals
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {pendingMembers.map((user: any, i: number) => (
                    <motion.div
                      key={user._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-2">
                          {user.batch || ''} {user.department ? `· ${user.department}` : ''}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>

        {/* Recent Activity */}
        <FadeIn direction="up" delay={0.7}>
          <div className="border rounded-lg p-4 sm:p-5 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-foreground">Recent Activity</h3>
              </div>
              <button
                onClick={() => navigate('/admin/logs')}
                className="text-xs text-primary hover:underline"
              >
                View all
              </button>
            </div>
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No recent activity</div>
            ) : (
              <div className="space-y-1">
                {recentLogs.map((log: any, i: number) => (
                  <motion.div
                    key={log._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log.action?.includes('delete') || log.action?.includes('reject') ? 'bg-red-500'
                        : log.action?.includes('create') || log.action?.includes('approve') ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {log.actor?._id ? <Link to={`/members/${log.actor._id}`} className="font-medium text-foreground hover:text-primary transition-colors">{log.actor.name}</Link> : <span className="font-medium text-foreground">System</span>}
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-muted-foreground font-mono text-xs">{log.action}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateCustom(dateStr, { month: 'short', day: 'numeric' });
}
