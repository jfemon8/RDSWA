import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function MentorshipPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'mentors' | 'my'>('mentors');
  const [areaSearch, setAreaSearch] = useState('');
  const [requestArea, setRequestArea] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);

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
    enabled: tab === 'my',
  });

  const requestMutation = useMutation({
    mutationFn: async ({ mentorId, area }: { mentorId: string; area: string }) => {
      const { data } = await api.post('/mentorships', { mentorId, area });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.my });
      setRequestingId(null);
      setRequestArea('');
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { data } = await api.patch(`/mentorships/${id}/${action}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.my });
    },
  });

  const mentors = mentorsData?.data || [];
  const myMentorships = myData?.data || [];

  const tabs = [
    { key: 'mentors', label: 'Find Mentors' },
    { key: 'my', label: 'My Mentorships' },
  ] as const;

  return (
    <div className="container mx-auto py-12">
      <BlurText
        text="Mentorship"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-8">
          Connect with experienced members for guidance and career mentorship.
        </p>
      </FadeIn>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b relative">
        {tabs.map((t) => (
          <motion.button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <motion.div
                layoutId="mentorship-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Find Mentors Tab */}
      {tab === 'mentors' && (
        <FadeIn direction="up" duration={0.4}>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by skill area..."
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {mentorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : mentors.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No mentors found.</p>
          ) : (
            <div className="grid grid-equal grid-cols-1 md:grid-cols-2 gap-4">
              {mentors.map((mentor: any, i: number) => (
                <FadeIn key={mentor._id} delay={i * 0.05} direction="up">
                  <div
                    className="rounded-xl border bg-card p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {mentor.avatar ? (
                          <img src={mentor.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          mentor.name?.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{mentor.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {mentor.profession || mentor.department || ''} {mentor.batch ? `• Batch ${mentor.batch}` : ''}
                        </p>
                        {mentor.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {mentor.skills.slice(0, 5).map((s: string, j: number) => (
                              <span key={j} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {user && user._id !== mentor._id && (
                      <div className="mt-4">
                        <AnimatePresence>
                          {requestingId === mentor._id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-2"
                            >
                              <input
                                placeholder="Area of mentorship (e.g. React, Career)"
                                value={requestArea}
                                onChange={(e) => setRequestArea(e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <div className="flex gap-2">
                                <button
                                  disabled={requestMutation.isPending}
                                  onClick={() => requestMutation.mutate({ mentorId: mentor._id, area: requestArea })}
                                  className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-1.5">
                                  {requestMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                                  Send Request
                                </button>
                                <button onClick={() => { setRequestingId(null); setRequestArea(''); }}
                                  className="px-4 py-1.5 text-sm border rounded-md hover:bg-muted">
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <button
                              onClick={() => setRequestingId(mentor._id)}
                              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                            >
                              <UserPlus className="h-4 w-4" /> Request Mentorship
                            </button>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </FadeIn>
      )}

      {/* My Mentorships Tab */}
      {tab === 'my' && (
        <FadeIn direction="up" duration={0.4}>
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : myMentorships.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No mentorships yet.</p>
          ) : (
            <div className="space-y-4">
              {myMentorships.map((m: any, i: number) => {
                const isMentor = m.mentor?._id === user?._id;
                const other = isMentor ? m.mentee : m.mentor;
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
                  active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
                  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
                };

                return (
                  <FadeIn key={m._id} delay={i * 0.05} direction="up">
                    <div className="rounded-xl border bg-card p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                            {other?.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{other?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isMentor ? 'You are mentoring' : 'Your mentor'} {m.area ? `• ${m.area}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[m.status] || ''}`}>
                            {m.status}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        {m.status === 'pending' && isMentor && (
                          <>
                            <button
                              onClick={() => actionMutation.mutate({ id: m._id, action: 'accept' })}
                              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-md">
                              <CheckCircle className="h-3.5 w-3.5" /> Accept
                            </button>
                            <button
                              onClick={() => actionMutation.mutate({ id: m._id, action: 'cancel' })}
                              className="flex items-center gap-1 px-3 py-1 text-sm border text-red-600 rounded-md">
                              <XCircle className="h-3.5 w-3.5" /> Decline
                            </button>
                          </>
                        )}
                        {m.status === 'pending' && !isMentor && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> Waiting for response
                          </span>
                        )}
                        {m.status === 'active' && (
                          <button
                            onClick={() => actionMutation.mutate({ id: m._id, action: 'complete' })}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md">
                            <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
                          </button>
                        )}
                        {(m.status === 'pending' || m.status === 'active') && (
                          <button
                            onClick={() => actionMutation.mutate({ id: m._id, action: 'cancel' })}
                            className="flex items-center gap-1 px-3 py-1 text-sm border rounded-md text-muted-foreground hover:text-foreground">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}
    </div>
  );
}
