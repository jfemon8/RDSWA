import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Vote, Loader2, CheckCircle, Clock, BarChart3, Radio, Timer } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { useVoteSocket } from '@/hooks/useSocket';
import SEO from '@/components/SEO';

export default function VotingPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.votes.all,
    queryFn: async () => {
      const { data } = await api.get('/votes');
      return data;
    },
  });

  const votes = data?.data || [];
  const active = votes.filter((v: any) => v.status === 'active');
  const closed = votes.filter((v: any) => v.status === 'closed' || v.status === 'published');

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <SEO title="Voting" description="Participate in RDSWA polls and elections — cast your vote on active polls." />
      <BlurText text="Voting & Polls" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6" delay={80} animateBy="words" direction="bottom" />

      {votes.length === 0 ? (
        <FadeIn delay={0.2} direction="up">
          <div className="text-center py-12">
            <Vote className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No polls available</p>
          </div>
        </FadeIn>
      ) : (
        <>
          {active.length > 0 && (
            <FadeIn delay={0.1} direction="up">
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Clock className="h-5 w-5 text-blue-500" /> Active Polls
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-xs font-normal text-green-600">Live</span>
                </h2>
                <div className="space-y-4">
                  {active.map((v: any, i: number) => (
                    <FadeIn key={v._id} delay={0.1 + i * 0.08} direction="up">
                      <VoteCard vote={v} />
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {closed.length > 0 && (
            <FadeIn delay={0.2} direction="up">
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" /> Past Polls
                </h2>
                <div className="space-y-4">
                  {closed.map((v: any, i: number) => (
                    <FadeIn key={v._id} delay={0.1 + i * 0.08} direction="up">
                      <VoteCard vote={v} />
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}

function useCountdown(endTime: string | undefined) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!endTime) return;

    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return timeLeft;
}

function CountdownDisplay({ endTime }: { endTime: string }) {
  const timeLeft = useCountdown(endTime);
  if (!timeLeft) return <span className="text-red-500 text-xs font-medium">Ending soon...</span>;

  const segments = [
    { value: timeLeft.days, label: 'd' },
    { value: timeLeft.hours, label: 'h' },
    { value: timeLeft.minutes, label: 'm' },
    { value: timeLeft.seconds, label: 's' },
  ];

  return (
    <div className="flex items-center gap-1">
      <Timer className="h-3.5 w-3.5 text-blue-500" />
      {segments.map((s, i) => (
        <span key={i} className="text-xs tabular-nums">
          <motion.span
            key={s.value}
            initial={{ opacity: 0.5, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="font-mono font-semibold"
          >
            {String(s.value).padStart(2, '0')}
          </motion.span>
          <span className="text-muted-foreground">{s.label}</span>
          {i < segments.length - 1 && <span className="text-muted-foreground mx-0.5">:</span>}
        </span>
      ))}
    </div>
  );
}

function VoteCard({ vote }: { vote: any }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>('');
  const [liveOptions, setLiveOptions] = useState<any[] | null>(null);
  const [liveTotalVotes, setLiveTotalVotes] = useState<number | null>(null);

  const hasVoted = vote.voters?.some((v: any) => v.user === user?._id || v.user?._id === user?._id);
  const isActive = vote.status === 'active';
  const showResults = vote.status === 'published' || (vote.status === 'closed' && vote.isResultPublic);

  // Real-time updates via Socket.IO
  const handleVoteUpdate = useCallback((data: any) => {
    setLiveOptions(data.options);
    setLiveTotalVotes(data.totalVotes);
  }, []);

  const handleStatusChange = useCallback((_data: any) => {
    // Refetch vote list when status changes (closed/published)
    queryClient.invalidateQueries({ queryKey: queryKeys.votes.all });
  }, [queryClient]);

  useVoteSocket(
    isActive ? vote._id : undefined, // Only subscribe to active votes
    handleVoteUpdate,
    handleStatusChange,
  );

  const castMutation = useMutation({
    mutationFn: () => api.post(`/votes/${vote._id}/cast`, { optionId: selected }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }),
  });

  // Use live data if available, otherwise fall back to API data
  const displayOptions = liveOptions || vote.options || [];
  const totalVotes = liveTotalVotes ?? (vote.options?.reduce((sum: number, o: any) => sum + (o.voteCount || 0), 0) || 1);
  const displayTotal = totalVotes || 1;

  return (
    <div className="border rounded-lg p-5 bg-card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold mb-1 text-foreground">{vote.title}</h3>
          {vote.description && <p className="text-sm text-muted-foreground mb-3">{vote.description}</p>}
        </div>
        {isActive && liveOptions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-xs text-green-600"
          >
            <Radio className="h-3 w-3" />
            Live
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
        {isActive ? (
          <CountdownDisplay endTime={vote.endTime} />
        ) : (
          <span>Closed</span>
        )}
        {totalVotes > 0 && (
          <motion.span
            key={totalVotes}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
          >
            · {totalVotes} votes
          </motion.span>
        )}
      </div>

      <div className="space-y-2">
        {displayOptions.map((o: any) => {
          const optionId = o._id?.toString?.() || o._id;
          const voteCount = o.voteCount || 0;
          const percentage = Math.round((voteCount / displayTotal) * 100);

          return (
            <div key={optionId}>
              {showResults || hasVoted ? (
                <div className="relative">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{o.text}</span>
                    <motion.span
                      key={voteCount}
                      initial={{ scale: 1.2, color: '#2563eb' }}
                      animate={{ scale: 1, color: 'var(--muted-foreground)' }}
                      transition={{ duration: 0.3 }}
                      className="text-muted-foreground tabular-nums"
                    >
                      {voteCount} ({percentage}%)
                    </motion.span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="bg-primary rounded-full h-2"
                      initial={false}
                      animate={{ width: `${(voteCount / displayTotal) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    />
                  </div>
                </div>
              ) : (
                <label className="flex items-center gap-3 p-2 border rounded-md hover:bg-accent cursor-pointer text-sm">
                  <input type="radio" name={`vote-${vote._id}`} value={optionId} checked={selected === optionId}
                    onChange={() => setSelected(optionId)} disabled={!isActive} />
                  {o.text}
                </label>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isActive && !hasVoted && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => castMutation.mutate()}
            disabled={!selected || castMutation.isPending}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {castMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Cast Vote
          </motion.button>
        )}
      </AnimatePresence>

      {hasVoted && isActive && (
        <p className="mt-3 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" /> You have voted
        </p>
      )}
    </div>
  );
}
