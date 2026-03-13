import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bell, FileText, Calendar, Users, Briefcase, GraduationCap, Clock, CheckCircle, XCircle, AlertCircle, ClipboardCheck, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

const membershipStatusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string; description: string }> = {
  none: { icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Not Applied', description: 'You haven\'t applied for membership yet.' },
  pending: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', label: 'Pending Review', description: 'Your application is being reviewed by the admin team.' },
  approved: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', label: 'Active Member', description: 'Your membership is active.' },
  rejected: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', label: 'Rejected', description: 'Your application was not approved. You may re-apply.' },
  suspended: { icon: XCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20', label: 'Suspended', description: 'Your membership has been suspended.' },
};

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=5');
      return data;
    },
  });

  const unreadCount = notifications?.data?.filter((n: any) => !n.isRead).length || 0;
  const msStatus = membershipStatusConfig[user?.membershipStatus || 'none'] || membershipStatusConfig.none;
  const MsIcon = msStatus.icon;

  const statusCards = [
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Membership',
      value: msStatus.label,
      color: msStatus.color,
    },
    {
      icon: <Bell className="h-5 w-5" />,
      label: 'Notifications',
      value: `${unreadCount} unread`,
      color: 'text-blue-600',
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: 'Role',
      value: user?.role?.replace('_', ' ') || 'User',
      color: 'text-purple-600',
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      label: 'Email',
      value: user?.isEmailVerified ? 'Verified' : 'Not Verified',
      color: user?.isEmailVerified ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">
        Welcome, {user?.name}
      </h1>

      {/* Membership Status Tracker */}
      <AnimatePresence>
        {user?.membershipStatus && user.membershipStatus !== 'approved' && (
          <FadeIn delay={0.05} direction="up">
            <motion.div
              className={`mb-6 p-4 rounded-xl border ${msStatus.bgColor}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3">
                <MsIcon className={`h-6 w-6 mt-0.5 ${msStatus.color}`} />
                <div className="flex-1">
                  <h3 className={`font-semibold ${msStatus.color}`}>{msStatus.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{msStatus.description}</p>

                  {/* Status timeline */}
                  <div className="flex items-center gap-2 mt-3">
                    {['Applied', 'Under Review', 'Decision'].map((step, idx) => {
                      const statusIdx = user.membershipStatus === 'none' ? -1 :
                        user.membershipStatus === 'pending' ? 1 :
                        user.membershipStatus === 'approved' ? 3 :
                        user.membershipStatus === 'rejected' ? 3 : 0;
                      const isActive = idx < statusIdx;
                      const isCurrent = idx === statusIdx - 1;
                      return (
                        <div key={step} className="flex items-center gap-2">
                          {idx > 0 && (
                            <div className={`h-0.5 w-6 ${isActive ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                          )}
                          <div className="flex items-center gap-1">
                            <div className={`h-2.5 w-2.5 rounded-full ${
                              isActive ? 'bg-primary' : isCurrent ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'
                            }`} />
                            <span className={`text-xs ${isActive || isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {step}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(user.membershipStatus === 'none' || user.membershipStatus === 'rejected') && (
                    <div className="mt-3">
                      <Link
                        to="/dashboard/forms/new"
                        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                      >
                        {user.membershipStatus === 'rejected' ? 'Re-apply' : 'Apply Now'}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </FadeIn>
        )}
      </AnimatePresence>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statusCards.map((card, i) => (
          <FadeIn key={card.label} delay={i * 0.08} direction="up">
            <StatusCard
              icon={card.icon}
              label={card.label}
              value={card.value}
              color={card.color}
            />
          </FadeIn>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction to="/dashboard/profile" label="View Profile" description="View and manage your personal information" />
        <QuickAction to="/dashboard/notifications" label="View Notifications" description="Check recent notifications" />
        <QuickAction to="/events" label="Browse Events" description="See upcoming events" />
        <QuickAction to="/notices" label="Read Notices" description="Latest announcements" />
        <QuickAction to="/dashboard/jobs" label="Job Board" description="Find job opportunities from alumni" icon={<Briefcase className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/mentorship" label="Mentorship" description="Connect with mentors for guidance" icon={<GraduationCap className="h-4 w-4 text-primary" />} />
        {user?.membershipStatus === 'none' && (
          <QuickAction to="/dashboard/forms/new" label="Apply for Membership" description="Submit your membership application" />
        )}
        <QuickAction to="/dashboard/attendance" label="Attendance History" description="View your event check-in records" icon={<ClipboardCheck className="h-4 w-4 text-primary" />} />
        <QuickAction to="/meetings" label="Meeting Records" description="View past and upcoming meetings" icon={<BookOpen className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/forms" label="My Submissions" description="Track your form submissions" />
        <QuickAction to="/donations" label="Make Donation" description="Support RDSWA activities" />
      </div>

      {/* Recent notifications */}
      {notifications?.data && notifications.data.length > 0 && (
        <FadeIn delay={0.2} direction="up">
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
            <div className="space-y-2">
              {notifications.data.slice(0, 5).map((n: any) => (
                <div key={n._id} className={`p-3 rounded-md border text-sm ${n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function StatusCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-background border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className={`text-lg font-semibold capitalize ${color}`}>{value}</p>
    </div>
  );
}

function QuickAction({ to, label, description, icon }: { to: string; label: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg">
      <Link to={to} className="block p-4 border rounded-lg hover:bg-accent transition-colors h-full">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-medium">{label}</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </Link>
    </div>
  );
}
