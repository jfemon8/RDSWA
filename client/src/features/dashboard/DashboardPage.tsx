import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bell, Shield, Users, Briefcase, GraduationCap, Clock, CheckCircle, XCircle, AlertCircle, ClipboardCheck, BookOpen, Mail, Send, User, Calendar, FileText, Heart, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { stripHtml } from '@/lib/stripHtml';

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
      icon: <Shield className="h-5 w-5" />,
      label: 'Role',
      value: user?.role?.replace('_', ' ') || 'User',
      color: 'text-purple-600',
    },
    {
      icon: <Mail className="h-5 w-5" />,
      label: 'Email',
      value: user?.isEmailVerified ? 'Verified' : 'Not Verified',
      color: user?.isEmailVerified ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div className="container mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">
        Welcome, {user?.nickName || user?.name}
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

      {/* Email verification prompt */}
      <AnimatePresence>
        {user && !user.isEmailVerified && (
          <FadeIn delay={0.05} direction="up">
            <EmailVerifyPrompt email={user.email} />
          </FadeIn>
        )}
      </AnimatePresence>

      {/* Status cards */}
      <div className="grid grid-equal grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
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
      <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction to="/dashboard/profile" label="View Profile" description="View and manage your personal information" icon={<User className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/notifications" label="View Notifications" description="Check recent notifications" icon={<Bell className="h-4 w-4 text-primary" />} />
        <QuickAction to="/events" label="Browse Events" description="See upcoming events" icon={<Calendar className="h-4 w-4 text-primary" />} />
        <QuickAction to="/notices" label="Read Notices" description="Latest announcements" icon={<Megaphone className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/jobs" label="Job Board" description="Find job opportunities from alumni" icon={<Briefcase className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/mentorship" label="Mentorship" description="Connect with mentors for guidance" icon={<GraduationCap className="h-4 w-4 text-primary" />} />
        {user?.membershipStatus === 'none' && (
          <QuickAction to="/dashboard/forms/new" label="Apply for Membership" description="Submit your membership application" icon={<Users className="h-4 w-4 text-primary" />} />
        )}
        <QuickAction to="/dashboard/attendance" label="Attendance History" description="View your event check-in records" icon={<ClipboardCheck className="h-4 w-4 text-primary" />} />
        <QuickAction to="/meetings" label="Meeting Records" description="View past and upcoming meetings" icon={<BookOpen className="h-4 w-4 text-primary" />} />
        <QuickAction to="/dashboard/forms" label="My Submissions" description="Track your form submissions" icon={<FileText className="h-4 w-4 text-primary" />} />
        <QuickAction to="/donations" label="Make Donation" description="Support RDSWA activities" icon={<Heart className="h-4 w-4 text-primary" />} />
      </div>

      {/* Recent notifications */}
      {notifications?.data && notifications.data.length > 0 && (
        <FadeIn delay={0.2} direction="up">
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
            <div className="space-y-2">
              {notifications.data.slice(0, 5).map((n: any) => (
                <div key={n._id} className={`p-3 rounded-md border text-sm ${n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}>
                  <p className="font-medium flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-primary shrink-0" /> {n.title}
                  </p>
                  <p className="text-muted-foreground">{stripHtml(n.message)}</p>
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
    <div className="bg-background border rounded-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5 sm:mb-2">
        {icon}
        <span className="text-xs sm:text-sm truncate">{label}</span>
      </div>
      <p className={`text-sm sm:text-lg font-semibold capitalize truncate ${color}`}>{value}</p>
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

function EmailVerifyPrompt({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuthStore();

  const sendOtp = async () => {
    setSending(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { setError('OTP must be 6 digits'); return; }
    setVerifying(true);
    setError('');
    try {
      await api.post('/auth/verify-otp', { email, otp });
      // Refresh user data
      const { data } = await api.get('/users/me');
      setUser(data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      className="mb-6 p-4 rounded-xl border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Verify your email</p>
          <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
            Your email is not verified yet. Verify now or do it later from your profile.
          </p>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
                <motion.button
                  onClick={sendOtp}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {sending ? <Clock className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Send Verification OTP
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="verify" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2">
                <input
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="Enter 6-digit OTP"
                  className="w-32 px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  maxLength={6}
                />
                <motion.button
                  onClick={verifyOtp}
                  disabled={verifying || otp.length !== 6}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {verifying ? <Clock className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Verify
                </motion.button>
                <button onClick={() => { setSent(false); setOtp(''); setError(''); }} className="text-xs text-amber-700 dark:text-amber-400 hover:underline">
                  Resend
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-600 mt-2">
              {error}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
