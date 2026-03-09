import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Pencil, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

export default function AdminCommitteesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { name: form.name, description: form.description, tenure: { startDate: form.startDate } };
      if (form.endDate) payload.tenure.endDate = form.endDate;
      if (editId) {
        const { data } = await api.patch(`/committees/${editId}`, payload);
        return data;
      }
      const { data } = await api.post('/committees', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', description: '', startDate: '', endDate: '' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/committees/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.committees.all }),
  });

  const committees = data?.data || [];

  const startEdit = (c: any) => {
    setEditId(c._id);
    setForm({
      name: c.name,
      description: c.description || '',
      startDate: c.tenure?.startDate ? new Date(c.tenure.startDate).toISOString().split('T')[0] : '',
      endDate: c.tenure?.endDate ? new Date(c.tenure.endDate).toISOString().split('T')[0] : '',
    });
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Committees</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', description: '', startDate: '', endDate: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Committee
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
              <h3 className="font-semibold mb-4">{editId ? 'Edit' : 'Create'} Committee</h3>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
                <input placeholder="Committee Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
                <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Date (optional)</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </motion.button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                    className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
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
          {committees.map((c: any, i: number) => (
            <FadeIn key={c._id} direction="up" delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                className="border rounded-lg p-4 bg-background"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{c.name}</h3>
                      {c.isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.tenure?.startDate && new Date(c.tenure.startDate).getFullYear()}
                      {c.tenure?.endDate ? ` - ${new Date(c.tenure.endDate).getFullYear()}` : ' - Present'}
                      {c.members && ` · ${c.members.length} members`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => startEdit(c)}
                      className="p-2 hover:bg-accent rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </motion.button>
                    {c.isCurrent && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => archiveMutation.mutate(c._id)}
                        className="p-2 hover:bg-accent rounded"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
