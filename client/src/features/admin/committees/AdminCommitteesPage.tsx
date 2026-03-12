import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Pencil, Archive, UserPlus, UserMinus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { CommitteePosition } from '@rdswa/shared';

const POSITIONS = Object.values(CommitteePosition);

export default function AdminCommitteesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Committees</h1>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', description: '', startDate: '', endDate: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Committee
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
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <h3 className="font-semibold mb-4 text-foreground">{editId ? 'Edit' : 'Create'} Committee</h3>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
                <input placeholder="Committee Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" required />
                <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Date (optional)</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                    className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
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
              <div
                className="border rounded-lg bg-card"
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{c.name}</h3>
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
                    <button
                      onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                      className="p-2 hover:bg-accent rounded"
                      title="Manage Members"
                    >
                      {expandedId === c._id ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="p-2 hover:bg-accent rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-foreground" />
                    </button>
                    {c.isCurrent && (
                      <button
                        onClick={() => archiveMutation.mutate(c._id)}
                        className="p-2 hover:bg-accent rounded"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4 text-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === c._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t p-4">
                        <CommitteeMembersPanel committeeId={c._id} members={c.members || []} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function CommitteeMembersPanel({ committeeId, members }: { committeeId: string; members: any[] }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [position, setPosition] = useState(CommitteePosition.MEMBER);

  const { data: searchData } = useQuery({
    queryKey: ['users', 'committee-search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users?search=${search}&limit=10`);
      return data;
    },
    enabled: search.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: () => api.post(`/committees/${committeeId}/members`, { userId: selectedUserId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      setShowAdd(false);
      setSearch('');
      setSelectedUserId('');
      setPosition(CommitteePosition.MEMBER);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/committees/${committeeId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.committees.all }),
  });

  const searchResults = searchData?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Members ({members.length})</h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
        >
          <UserPlus className="h-3 w-3" /> Add Member
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border rounded-md p-3 bg-muted/30 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search user..."
                  className="w-full pl-8 pr-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
                />
              </div>
              {search.length >= 2 && searchResults.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto bg-card">
                  {searchResults.map((u: any) => (
                    <button
                      key={u._id}
                      onClick={() => { setSelectedUserId(u._id); setSearch(u.name); }}
                      className={`w-full text-left px-3 py-1.5 text-xs border-b last:border-b-0 hover:bg-accent ${
                        selectedUserId === u._id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className="text-foreground">{u.name}</span> <span className="text-muted-foreground">({u.email})</span>
                    </button>
                  ))}
                </div>
              )}
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as CommitteePosition)}
                className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm capitalize"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p} className="capitalize">{p.replace('_', ' ')}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => addMutation.mutate()}
                  disabled={!selectedUserId || addMutation.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs disabled:opacity-50"
                >
                  {addMutation.isPending ? 'Adding...' : 'Add'}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border rounded-md text-xs hover:bg-accent text-foreground">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No members in this committee</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m: any, i: number) => (
            <motion.div
              key={m.user?._id || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {m.user?.avatar ? (
                  <img src={m.user.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
                    {m.user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{m.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.position?.replace('_', ' ')}</p>
                </div>
              </div>
              <button
                onClick={() => removeMutation.mutate(m.user?._id)}
                disabled={removeMutation.isPending}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                title="Remove"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
