import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Loader2, UserPlus, ArrowDown, Search, Crown } from 'lucide-react';

export default function AdminAdminsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showPromote, setShowPromote] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: async () => {
      const { data } = await api.get('/admin/admins');
      return data;
    },
  });

  const { data: searchData } = useQuery({
    queryKey: ['users', 'search-admin', search],
    queryFn: async () => {
      const { data } = await api.get(`/users?search=${search}&limit=10`);
      return data;
    },
    enabled: search.length >= 2,
  });

  const promoteMutation = useMutation({
    mutationFn: () => api.post(`/admin/admins/${selectedUserId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      setShowPromote(false);
      setSelectedUserId('');
      setSearch('');
      toast.success('User promoted to admin');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to promote user'); },
  });

  const demoteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/admins/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }); toast.success('Admin demoted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to demote admin'); },
  });

  const admins = data?.data || [];
  const searchResults = searchData?.data || [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Management</h1>
        <button
          onClick={() => setShowPromote(!showPromote)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <UserPlus className="h-4 w-4" /> Promote to Admin
        </button>
      </div>

      <FadeIn direction="up" delay={0.05}>
        <div className="border rounded-lg p-4 bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/40">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Only Super Admins can manage admin roles. Super Admin status is assigned to hardcoded emails and cannot be modified here.
          </p>
        </div>
      </FadeIn>

      {/* Promote Form */}
      <AnimatePresence>
        {showPromote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card">
              <h3 className="font-semibold mb-4 text-foreground">Promote User to Admin</h3>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => promoteMutation.mutate()}
                    disabled={!selectedUserId || promoteMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                  >
                    {promoteMutation.isPending ? 'Promoting...' : 'Promote'}
                  </button>
                  <button onClick={() => setShowPromote(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admins List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12">
          <Crown className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No admins found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map((admin: any, i: number) => (
            <FadeIn key={admin._id} direction="up" delay={i * 0.05}>
              <div
                className="border rounded-lg p-4 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {admin.avatar ? (
                    <img src={admin.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium text-foreground">
                      {admin.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{admin.name}</p>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                  </div>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium ${
                    admin.role === 'super_admin'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
                {admin.role !== 'super_admin' && (
                  <button
                    onClick={() => demoteMutation.mutate(admin._id)}
                    disabled={demoteMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Demote admin"
                  >
                    <ArrowDown className="h-3 w-3" /> Demote
                  </button>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
