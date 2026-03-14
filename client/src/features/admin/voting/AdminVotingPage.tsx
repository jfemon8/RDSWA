import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Trash2, Eye, BarChart3, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/date';

export default function AdminVotingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [statsId, setStatsId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', startTime: '', endTime: '',
    eligibleVoters: 'all_members', options: ['', ''],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.votes.all,
    queryFn: async () => {
      const { data } = await api.get('/votes');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/votes', {
      ...form,
      options: form.options.filter(Boolean).map((text) => ({ text })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.votes.all });
      setShowForm(false);
      setForm({ title: '', description: '', startTime: '', endTime: '', eligibleVoters: 'all_members', options: ['', ''] });
      toast.success('Poll created successfully');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to create poll'); },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/votes/${id}/publish`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }); toast.success('Results published'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to publish results'); },
  });

  const votes = data?.data || [];

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Voting & Polls</h1>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Poll
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="border rounded-lg p-4 sm:p-6 bg-card mb-6">
                <h3 className="font-semibold text-foreground mb-4">Create Poll</h3>
                <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Poll title is required'; if (!form.startTime) errs.startTime = 'Start time is required'; if (!form.endTime) errs.endTime = 'End time is required'; if (form.options.filter(Boolean).length < 2) errs.options = 'At least 2 options are required'; if (Object.keys(errs).length) { setErrors(errs); return; } createMutation.mutate(); }} className="space-y-3">
                  <div>
                    <input placeholder="Poll Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.title} />
                  </div>
                  <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Start Time</label>
                      <input type="datetime-local" value={form.startTime} onChange={(e) => { setForm({ ...form, startTime: e.target.value }); setErrors((prev) => { const { startTime, ...rest } = prev; return rest; }); }}
                        className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.startTime ? 'border-red-500' : ''}`} required />
                      <FieldError message={errors.startTime} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End Time</label>
                      <input type="datetime-local" value={form.endTime} onChange={(e) => { setForm({ ...form, endTime: e.target.value }); setErrors((prev) => { const { endTime, ...rest } = prev; return rest; }); }}
                        className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.endTime ? 'border-red-500' : ''}`} required />
                      <FieldError message={errors.endTime} />
                    </div>
                  </div>
                  <select value={form.eligibleVoters} onChange={(e) => setForm({ ...form, eligibleVoters: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="all_members">All Members</option>
                    <option value="batch_specific">Batch Specific</option>
                    <option value="role_specific">Role Specific</option>
                  </select>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Options</label>
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input placeholder={`Option ${i + 1}`} value={opt}
                          onChange={(e) => {
                            const newOpts = [...form.options];
                            newOpts[i] = e.target.value;
                            setForm({ ...form, options: newOpts });
                          }}
                          className="flex-1 px-3 py-2 border rounded-md bg-card text-foreground text-sm" required />
                        {form.options.length > 2 && (
                          <button type="button" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({ ...form, options: [...form.options, ''] })}
                      className="text-sm text-primary hover:underline">+ Add option</button>
                    <FieldError message={errors.options} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 border rounded-md text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {votes.map((v: any, index: number) => (
              <FadeIn key={v._id} direction="up" delay={index * 0.05} duration={0.4}>
                <motion.div
                  layout
                  transition={{ duration: 0.2 }}
                  className="border rounded-lg bg-card overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 gap-2">
                    <div>
                      <h3 className="font-medium text-foreground">{v.title}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        <span className={`capitalize px-1.5 py-0.5 rounded ${
                          v.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : v.status === 'published' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : v.status === 'closed' ? 'bg-muted text-muted-foreground'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>{v.status}</span>
                        <span>{v.totalVotes || 0} votes</span>
                        <span>Ends {formatDate(v.endTime)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.status === 'closed' && !v.isResultPublic && (
                        <button
                          onClick={() => publishMutation.mutate(v._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md">
                          <Eye className="h-3 w-3" /> Publish
                        </button>
                      )}
                      <button
                        onClick={() => setStatsId(statsId === v._id ? null : v._id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-accent"
                      >
                        <BarChart3 className="h-3 w-3" /> Stats
                        {statsId === v._id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {statsId === v._id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <VoteStatsPanel voteId={v._id} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function VoteStatsPanel({ voteId }: { voteId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['votes', 'stats', voteId],
    queryFn: async () => {
      const { data } = await api.get(`/votes/${voteId}/stats`);
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-6 border-t"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  const stats = data?.data;
  if (!stats) return null;

  return (
    <div className="border-t p-4 sm:p-6 space-y-4 bg-muted/20">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FadeIn delay={0} direction="up">
          <div className="border rounded-lg p-3 bg-card text-center">
            <p className="text-xs text-muted-foreground">Total Voters</p>
            <p className="text-xl font-bold text-foreground">{stats.totalVoters}</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05} direction="up">
          <div className="border rounded-lg p-3 bg-card text-center">
            <p className="text-xs text-muted-foreground">Total Votes</p>
            <p className="text-xl font-bold text-primary">{stats.totalVotes}</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1} direction="up">
          <div className="border rounded-lg p-3 bg-card text-center">
            <p className="text-xs text-muted-foreground">Skipped</p>
            <p className="text-xl font-bold text-orange-500">{stats.skippedCount}</p>
          </div>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Batch */}
        {stats.byBatch?.length > 0 && (
          <FadeIn delay={0.15} direction="up">
            <div className="border rounded-lg p-3 bg-card">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">By Batch</h4>
              <div className="space-y-1.5">
                {stats.byBatch.map((b: any) => (
                  <div key={b.batch} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">Batch {b.batch}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <motion.div
                          className="bg-blue-500 rounded-full h-1.5"
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.count / stats.totalVoters) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{b.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* By Role */}
        {stats.byRole?.length > 0 && (
          <FadeIn delay={0.2} direction="up">
            <div className="border rounded-lg p-3 bg-card">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">By Role</h4>
              <div className="space-y-1.5">
                {stats.byRole.map((r: any) => (
                  <div key={r.role} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{r.role.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <motion.div
                          className="bg-purple-500 rounded-full h-1.5"
                          initial={{ width: 0 }}
                          animate={{ width: `${(r.count / stats.totalVoters) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">{r.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Voter List */}
      <FadeIn delay={0.25} direction="up">
        <div className="border rounded-lg p-3 bg-card">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> Voters ({stats.voters?.length || 0})
          </h4>
          {stats.voters?.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {stats.voters.map((v: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{v.name}</span>
                    {v.batch && <span className="text-muted-foreground">Batch {v.batch}</span>}
                    <span className="capitalize text-muted-foreground">{v.role?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.skipped && <span className="text-orange-500 text-xs">Skipped</span>}
                    <span className="text-muted-foreground">
                      {formatDateTime(v.votedAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No voters yet</p>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
