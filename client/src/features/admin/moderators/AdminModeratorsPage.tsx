import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Loader2, UserPlus, UserMinus, Search, Shield } from 'lucide-react';
import { useConfirm } from '@/components/ui/ConfirmModal';

export default function AdminModeratorsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showAssign, setShowAssign] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'moderators'],
    queryFn: async () => {
      const { data } = await api.get('/admin/moderators');
      return data;
    },
  });

  // Search users for assignment
  const { data: searchData } = useQuery({
    queryKey: ['users', 'search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users?search=${search}&limit=10`);
      return data;
    },
    enabled: search.length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/moderators/${selectedUserId}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderators'] });
      setShowAssign(false);
      setSelectedUserId('');
      setReason('');
      setSearch('');
      toast.success('Moderator assigned');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to assign moderator'); },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/moderators/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'moderators'] }); toast.success('Moderator removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to remove moderator'); },
  });

  const moderators = data?.data || [];
  const searchResults = searchData?.data || [];

  return (
    <div className="container mx-auto space-y-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Moderator Management</h1>
        <button
          onClick={() => setShowAssign(!showAssign)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <UserPlus className="h-4 w-4" /> Assign Moderator
        </button>
      </div>

      {/* Assign Form */}
      <AnimatePresence>
        {showAssign && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card">
              <h3 className="font-semibold mb-4 text-foreground">Assign New Moderator</h3>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user by name or email..."
                    className="w-full pl-9 pr-3 py-2 border rounded-md bg-card text-foreground text-sm"
                  />
                </div>
                {search.length >= 2 && searchResults.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {searchResults.map((u: any) => (
                      <button
                        key={u._id}
                        onClick={() => { setSelectedUserId(u._id); setSearch(u.name); }}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 flex items-center gap-3 hover:bg-accent ${
                          selectedUserId === u._id ? 'bg-primary/10' : ''
                        }`}
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground">
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email} · {u.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for assignment (optional)"
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => assignMutation.mutate()}
                    disabled={!selectedUserId || assignMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                  >
                    {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                  </button>
                  <button onClick={() => setShowAssign(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moderators List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : moderators.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No moderators assigned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {moderators.map((mod: any, i: number) => (
            <FadeIn key={mod._id} direction="up" delay={i * 0.05}>
              <div
                className="border rounded-lg p-4 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {mod.avatar ? (
                    <img src={mod.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium text-foreground">
                      {mod.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{mod.name}</p>
                    <p className="text-sm text-muted-foreground">{mod.email}</p>
                  </div>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full capitalize ${
                    mod.role === 'admin' || mod.role === 'super_admin'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {mod.role?.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {mod.moderatorAssignment && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {mod.moderatorAssignment.type === 'auto' ? 'Auto-assigned' : 'Manual'}
                      {mod.moderatorAssignment.reason && ` · ${mod.moderatorAssignment.reason.replace('_', ' ')}`}
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: 'Remove Moderator', message: `Remove ${mod.name} as a moderator? They will return to their base role.`, confirmLabel: 'Remove', variant: 'danger' });
                      if (ok) removeMutation.mutate(mod._id);
                    }}
                    disabled={removeMutation.isPending}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                    title="Remove moderator"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
