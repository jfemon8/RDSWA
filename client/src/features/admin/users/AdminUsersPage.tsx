import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Loader2, UserCheck, UserX, Ban } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (search) filters.search = search;
  if (role) filters.role = role;
  if (status) filters.membershipStatus = status;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/users?${params}`);
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/reject`, { reason: 'Rejected by admin' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/suspend`, { reason: 'Suspended by admin' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const users = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <FadeIn direction="up" delay={0}>
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md bg-background text-sm">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="member">Member</option>
            <option value="alumni">Alumni</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md bg-background text-sm">
            <option value="">All Status</option>
            <option value="none">No Application</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Membership</th>
                    <th className="text-left p-3 font-medium">Batch</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <motion.tr
                      key={u._id}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="border-t hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {u.name?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <select value={u.role} onChange={(e) => changeRoleMutation.mutate({ id: u._id, role: e.target.value })}
                          className="px-2 py-1 border rounded text-xs bg-background">
                          <option value="user">User</option>
                          <option value="member">Member</option>
                          <option value="alumni">Alumni</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          u.membershipStatus === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : u.membershipStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : u.membershipStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : u.membershipStatus === 'suspended' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {u.membershipStatus}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{u.batch || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {u.membershipStatus === 'pending' && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => approveMutation.mutate(u._id)}
                                title="Approve"
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              >
                                <UserCheck className="h-4 w-4" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => rejectMutation.mutate(u._id)}
                                title="Reject"
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <UserX className="h-4 w-4" />
                              </motion.button>
                            </>
                          )}
                          {u.membershipStatus !== 'suspended' && u.role !== 'super_admin' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => suspendMutation.mutate(u._id)}
                              title="Suspend"
                              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                            >
                              <Ban className="h-4 w-4" />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
