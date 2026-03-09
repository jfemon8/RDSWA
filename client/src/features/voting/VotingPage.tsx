import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Vote, Loader2, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import { useState } from 'react';

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
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Voting & Polls</h1>

      {votes.length === 0 ? (
        <div className="text-center py-12">
          <Vote className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No polls available</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" /> Active Polls
              </h2>
              <div className="space-y-4">
                {active.map((v: any) => <VoteCard key={v._id} vote={v} />)}
              </div>
            </div>
          )}

          {closed.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-500" /> Past Polls
              </h2>
              <div className="space-y-4">
                {closed.map((v: any) => <VoteCard key={v._id} vote={v} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VoteCard({ vote }: { vote: any }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>('');

  const hasVoted = vote.voters?.some((v: any) => v.user === user?._id || v.user?._id === user?._id);
  const isActive = vote.status === 'active';
  const showResults = vote.status === 'published' || (vote.status === 'closed' && vote.isResultPublic);

  const castMutation = useMutation({
    mutationFn: () => api.post(`/votes/${vote._id}/cast`, { optionId: selected }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }),
  });

  const totalVotes = vote.options?.reduce((sum: number, o: any) => sum + (o.voteCount || 0), 0) || 1;

  return (
    <div className="border rounded-lg p-5 bg-background">
      <h3 className="font-semibold mb-1">{vote.title}</h3>
      {vote.description && <p className="text-sm text-muted-foreground mb-3">{vote.description}</p>}

      <div className="text-xs text-muted-foreground mb-3">
        {isActive ? `Ends ${new Date(vote.endTime).toLocaleDateString('en-US', { dateStyle: 'medium' })}` : 'Closed'}
        {vote.totalVotes > 0 && ` · ${vote.totalVotes} votes`}
      </div>

      <div className="space-y-2">
        {vote.options?.map((o: any) => (
          <div key={o._id}>
            {showResults || hasVoted ? (
              <div className="relative">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{o.text}</span>
                  <span className="text-muted-foreground">{o.voteCount || 0} ({Math.round(((o.voteCount || 0) / totalVotes) * 100)}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${((o.voteCount || 0) / totalVotes) * 100}%` }} />
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-2 border rounded-md hover:bg-accent cursor-pointer text-sm">
                <input type="radio" name={`vote-${vote._id}`} value={o._id} checked={selected === o._id}
                  onChange={() => setSelected(o._id)} disabled={!isActive} />
                {o.text}
              </label>
            )}
          </div>
        ))}
      </div>

      {isActive && !hasVoted && (
        <button onClick={() => castMutation.mutate()} disabled={!selected || castMutation.isPending}
          className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
          {castMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Cast Vote
        </button>
      )}

      {hasVoted && isActive && (
        <p className="mt-3 text-sm text-green-600 flex items-center gap-1">
          <CheckCircle className="h-4 w-4" /> You have voted
        </p>
      )}
    </div>
  );
}
