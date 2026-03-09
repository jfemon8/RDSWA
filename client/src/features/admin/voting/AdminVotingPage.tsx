import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Trash2, Eye } from 'lucide-react';

export default function AdminVotingPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', startTime: '', endTime: '',
    eligibleVoters: 'all_members', options: ['', ''],
  });

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
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/votes/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.votes.all }),
  });

  const votes = data?.data || [];

  return (
    <FadeIn direction="up">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Voting & Polls</h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Poll
          </motion.button>
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
              <div className="border rounded-lg p-5 bg-background mb-6">
                <h3 className="font-semibold mb-4">Create Poll</h3>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
                  <input placeholder="Poll Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
                  <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Start Time</label>
                      <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End Time</label>
                      <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
                    </div>
                  </div>
                  <select value={form.eligibleVoters} onChange={(e) => setForm({ ...form, eligibleVoters: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm">
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
                          className="flex-1 px-3 py-2 border rounded-md bg-background text-sm" required />
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
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={createMutation.isPending}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                      Create
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 border rounded-md text-sm">
                      Cancel
                    </motion.button>
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
                  whileHover={{ scale: 1.01, backgroundColor: 'var(--accent)' }}
                  transition={{ duration: 0.2 }}
                  className="border rounded-lg p-4 bg-background"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{v.title}</h3>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="capitalize">{v.status}</span>
                        <span>{v.totalVotes || 0} votes</span>
                        <span>Ends {new Date(v.endTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {v.status === 'closed' && !v.isResultPublic && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => publishMutation.mutate(v._id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md">
                        <Eye className="h-3 w-3" /> Publish Results
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
