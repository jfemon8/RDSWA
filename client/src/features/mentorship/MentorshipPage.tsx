import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, UserPlus, CheckCircle, XCircle, Clock, Loader2,
  GraduationCap, Award, Star, Mail, Phone, Users,
  MessagesSquare, Calendar, ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/date';
import { useConfirm } from '@/components/ui/ConfirmModal';

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
}

export default function MentorshipPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'mentors' | 'my-mentors' | 'my-trainees'>('mentors');
  const [areaSearch, setAreaSearch] = useState('');
  const [requestArea, setRequestArea] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const isMentorEligible = user?.isAlumni || user?.isAdvisor || user?.isSeniorAdvisor;

  const { data: mentorsData, isLoading: mentorsLoading } = useQuery({
    queryKey: [...queryKeys.mentorships.mentors, areaSearch],
    queryFn: async () => {
      const params = areaSearch ? `?area=${areaSearch}` : '';
      const { data } = await api.get(`/mentorships/mentors${params}`);
      return data;
    },
    enabled: tab === 'mentors',
  });

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: queryKeys.mentorships.my,
    queryFn: async () => {
      const { data } = await api.get('/mentorships/my');
      return data;
    },
    enabled: tab === 'my-mentors' || tab === 'my-trainees',
  });

  const requestMutation = useMutation({
    mutationFn: async ({ mentorId, area }: { mentorId: string; area: string }) => {
      const { data } = await api.post('/mentorships', { mentorId, area });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.my });
      toast.success('Mentorship request sent!');
      setRequestingId(null);
      setRequestArea('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Request failed'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { data } = await api.patch(`/mentorships/${id}/${action}`);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.my });
      const msg = vars.action === 'accept' ? 'Mentorship accepted! Consultation group created.'
        : vars.action === 'complete' ? 'Mentorship completed.'
        : 'Mentorship cancelled.';
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Action failed'),
  });

  const mentors = mentorsData?.data || [];
  const allMentorships = myData?.data || [];

  // Split mentorships by role
  const myMentors = useMemo(() =>
    allMentorships.filter((m: any) => m.mentee?._id === user?._id),
    [allMentorships, user?._id]
  );
  const myTrainees = useMemo(() =>
    allMentorships.filter((m: any) => m.mentor?._id === user?._id),
    [allMentorships, user?._id]
  );

  const pendingRequests = myTrainees.filter((m: any) => m.status === 'pending').length;

  const tabs = [
    { key: 'mentors' as const, label: 'Find Mentors', icon: Search },
    { key: 'my-mentors' as const, label: 'My Mentors', icon: GraduationCap },
    ...(isMentorEligible ? [{
      key: 'my-trainees' as const,
      label: `My Trainees${pendingRequests ? ` (${pendingRequests})` : ''}`,
      icon: Users,
    }] : []),
  ];

  function getMentorTag(mentor: any): { label: string; icon: typeof GraduationCap; color: string; bgColor: string } {
    if (mentor.isSeniorAdvisor) return { label: 'Senior Advisor', icon: Star, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' };
    if (mentor.isAdvisor) return { label: 'Advisor', icon: Award, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/30' };
    return { label: 'Alumni', icon: GraduationCap, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
  }

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20', label: 'Pending' },
    active: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', label: 'Active' },
    completed: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20', label: 'Completed' },
    cancelled: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: 'Cancelled' },
  };

  function renderMentorshipCard(m: any, isMentor: boolean, index: number) {
    const other = isMentor ? m.mentee : m.mentor;
    const sc = statusConfig[m.status] || statusConfig.pending;

    return (
      <FadeIn key={m._id} delay={index * 0.05} direction="up">
        <motion.div
          className="rounded-xl border bg-card overflow-hidden"
          whileHover={{ y: -1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link to={`/members/${other?._id}`} className="shrink-0">
                  {other?.avatar ? (
                    <img src={other.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                      {other?.name?.charAt(0) || '?'}
                    </div>
                  )}
                </Link>
                <div className="min-w-0">
                  <Link to={`/members/${other?._id}`} className="font-medium hover:text-primary transition-colors truncate block">
                    {other?.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {other?.profession || other?.department || ''}
                    {other?.batch ? ` • Batch ${other.batch}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-medium ${sc.bg} ${sc.color}`}>
                  {sc.label}
                </span>
                {m.area && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {m.area}
                  </span>
                )}
              </div>
            </div>

            {/* Timeline info */}
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Requested {timeAgo(m.requestedAt || m.createdAt)}
              </span>
              {m.acceptedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> Accepted {formatDate(m.acceptedAt)}
                </span>
              )}
              {m.completedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-blue-500" /> Completed {formatDate(m.completedAt)}
                </span>
              )}
            </div>

            {/* Contact info for active mentorships */}
            {m.status === 'active' && (other?.email || other?.phone) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 rounded-lg bg-muted/50 space-y-1.5"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Contact Info</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {other.email && (
                    <a href={`mailto:${other.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                      <Mail className="h-3.5 w-3.5" /> {other.email}
                    </a>
                  )}
                  {other.phone && (
                    <a href={`tel:${other.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {other.phone}
                    </a>
                  )}
                </div>
              </motion.div>
            )}

            {/* Quick actions for active */}
            {m.status === 'active' && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  to={`/dashboard/messages?with=${other?._id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
                >
                  <MessagesSquare className="h-3.5 w-3.5" /> Message
                </Link>
                <Link
                  to={`/dashboard/groups`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
                >
                  <Users className="h-3.5 w-3.5" /> Consultation Group
                </Link>
              </div>
            )}
          </div>

          {/* Actions footer */}
          {!['completed', 'cancelled'].includes(m.status) && (
            <div className="flex flex-wrap gap-2 px-5 py-3 border-t bg-muted/20">
              {m.status === 'pending' && isMentor && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => actionMutation.mutate({ id: m._id, action: 'accept' })}
                    disabled={actionMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle className="h-3.5 w-3.5" /> Accept
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      const ok = await confirm({ title: 'Decline Request', message: 'Decline this mentorship request? The mentee will be notified.', confirmLabel: 'Decline', variant: 'danger' });
                      if (ok) actionMutation.mutate({ id: m._id, action: 'cancel' });
                    }}
                    disabled={actionMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </motion.button>
                </>
              )}
              {m.status === 'pending' && !isMentor && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 animate-pulse" /> Waiting for mentor's response
                </span>
              )}
              {m.status === 'active' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Complete Mentorship', message: 'Mark this mentorship as complete? This will close the consultation group.', confirmLabel: 'Complete', variant: 'info' });
                    if (ok) actionMutation.mutate({ id: m._id, action: 'complete' });
                  }}
                  disabled={actionMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
                </motion.button>
              )}
              {(m.status === 'pending' || m.status === 'active') && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Cancel Mentorship', message: m.status === 'active' ? 'Cancel this active mentorship? The consultation group will be closed.' : 'Cancel this mentorship request?', confirmLabel: 'Yes, cancel', cancelLabel: 'Keep', variant: 'danger' });
                    if (ok) actionMutation.mutate({ id: m._id, action: 'cancel' });
                  }}
                  disabled={actionMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50">
                  Cancel
                </motion.button>
              )}
            </div>
          )}
        </motion.div>
      </FadeIn>
    );
  }

  return (
    <div className="container mx-auto py-6 md:py-12">
      <BlurText
        text="Mentorship"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-8">
          Connect with experienced Alumni, Advisors, and Senior Advisors for guidance and career mentorship.
        </p>
      </FadeIn>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b relative overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {tab === t.key && (
                <motion.div
                  layoutId="mentorship-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Find Mentors Tab ── */}
      {tab === 'mentors' && (
        <FadeIn direction="up" duration={0.4}>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by skill area (e.g. React, Machine Learning, Career)..."
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {mentorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : mentors.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">No mentors found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Try a different skill area or check back later</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mentors.map((mentor: any, i: number) => {
                const tag = getMentorTag(mentor);
                const TagIcon = tag.icon;
                return (
                  <FadeIn key={mentor._id} delay={i * 0.05} direction="up">
                    <motion.div
                      className="rounded-xl border bg-card p-5 h-full flex flex-col"
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <Link to={`/members/${mentor._id}`} className="shrink-0">
                          {mentor.avatar ? (
                            <img src={mentor.avatar} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/10" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-primary/10">
                              {mentor.name?.charAt(0)}
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/members/${mentor._id}`} className="font-semibold hover:text-primary transition-colors">
                              {mentor.name}
                            </Link>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${tag.bgColor} ${tag.color}`}>
                              <TagIcon className="h-3 w-3" /> {tag.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {mentor.profession || mentor.department || ''} {mentor.batch ? `• Batch ${mentor.batch}` : ''}
                          </p>
                          {mentor.activeMentees > 0 && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                              <Users className="h-3 w-3" /> Mentoring {mentor.activeMentees} {mentor.activeMentees === 1 ? 'trainee' : 'trainees'}
                            </p>
                          )}
                          {mentor.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {mentor.skills.slice(0, 5).map((s: string, j: number) => (
                                <span key={j} className="px-2 py-0.5 text-[11px] bg-primary/10 text-primary rounded-md">{s}</span>
                              ))}
                              {mentor.skills.length > 5 && (
                                <span className="text-[11px] text-muted-foreground">+{mentor.skills.length - 5}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {user && user._id !== mentor._id && (
                        <div className="mt-4 pt-3 border-t">
                          <AnimatePresence mode="wait">
                            {requestingId === mentor._id ? (
                              <motion.div
                                key="form"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2"
                              >
                                <input
                                  placeholder="Area of mentorship (e.g. React, Career, Research)"
                                  value={requestArea}
                                  onChange={(e) => setRequestArea(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <div className="flex gap-2">
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    disabled={requestMutation.isPending}
                                    onClick={() => requestMutation.mutate({ mentorId: mentor._id, area: requestArea })}
                                    className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-1.5">
                                    {requestMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Send Request
                                  </motion.button>
                                  <button onClick={() => { setRequestingId(null); setRequestArea(''); }}
                                    className="px-4 py-1.5 text-sm border rounded-md hover:bg-muted">
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="btn"
                                onClick={() => setRequestingId(mentor._id)}
                                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                                whileHover={{ x: 4 }}
                              >
                                <UserPlus className="h-4 w-4" /> Request Mentorship <ArrowRight className="h-3 w-3" />
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}

      {/* ── My Mentors Tab ── */}
      {tab === 'my-mentors' && (
        <FadeIn direction="up" duration={0.4}>
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : myMentors.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">No mentors yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Browse the "Find Mentors" tab to request mentorship</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab('mentors')}
                className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" /> Find Mentors
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {myMentors.map((m: any, i: number) => renderMentorshipCard(m, false, i))}
            </div>
          )}
        </FadeIn>
      )}

      {/* ── My Trainees Tab (Mentor view) ── */}
      {tab === 'my-trainees' && isMentorEligible && (
        <FadeIn direction="up" duration={0.4}>
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : myTrainees.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">No trainee requests yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Members can find you in the mentor directory and send requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending first, then active, then rest */}
              {[...myTrainees]
                .sort((a: any, b: any) => {
                  const order: Record<string, number> = { pending: 0, active: 1, completed: 2, cancelled: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                })
                .map((m: any, i: number) => renderMentorshipCard(m, true, i))
              }
            </div>
          )}
        </FadeIn>
      )}
    </div>
  );
}
