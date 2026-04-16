import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { Search, Loader2, UserCheck, UserX, Ban, Download, FileText, FileSpreadsheet, Mail, Trash2, Award, Star, ExternalLink, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadTablePdf } from '@/lib/downloadPdf';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useConfirm } from '@/components/ui/ConfirmModal';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser ? hasMinRole(currentUser.role, UserRole.ADMIN) : false;
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [bulkEmail, setBulkEmail] = useState({ subject: '', body: '' });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User approved'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to approve user'); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/reject`, { reason: 'Rejected by admin' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User rejected'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to reject user'); },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/suspend`, { reason: 'Suspended by admin' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User suspended'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to suspend user'); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete user'); },
  });

  const isSuperAdmin = currentUser ? hasMinRole(currentUser.role, UserRole.SUPER_ADMIN) : false;

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Role updated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to change role'); },
  });

  const setAdvisorMutation = useMutation({
    mutationFn: ({ id, grant }: { id: string; grant: boolean }) => api.patch(`/users/${id}/advisor`, { grant }),
    onSuccess: (_d, vars) => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success(vars.grant ? 'Advisor granted' : 'Advisor revoked'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const setSeniorAdvisorMutation = useMutation({
    mutationFn: ({ id, grant }: { id: string; grant: boolean }) => api.patch(`/users/${id}/senior-advisor`, { grant }),
    onSuccess: (_d, vars) => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success(vars.grant ? 'Senior Advisor granted' : 'Senior Advisor revoked'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/admin/bulk/approve', { userIds: ids }),
    onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSelectedIds(new Set()); toast.success(res.data?.message || 'Bulk approved'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Bulk approve failed'); },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/admin/bulk/reject', { userIds: ids }),
    onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSelectedIds(new Set()); toast.success(res.data?.message || 'Bulk rejected'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Bulk reject failed'); },
  });

  const bulkEmailMutation = useMutation({
    mutationFn: ({ ids, subject, body }: { ids: string[]; subject: string; body: string }) => api.post('/admin/bulk/email', { userIds: ids, subject, body }),
    onSuccess: (res: any) => { queryClient.invalidateQueries({ queryKey: ['users'] }); setSelectedIds(new Set()); setShowEmailForm(false); setBulkEmail({ subject: '', body: '' }); toast.success(res.data?.message || 'Emails sent'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Bulk email failed'); },
  });

  const users = data?.data || [];
  const pagination = data?.pagination;

  // Build export URL with current filters (no pagination — exports ALL matching rows)
  const exportParams = new URLSearchParams();
  if (search) exportParams.set('search', search);
  if (role) exportParams.set('role', role);
  if (status) exportParams.set('membershipStatus', status);
  const exportQuery = exportParams.toString() ? `&${exportParams}` : '';

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">User Management</h1>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {([
              { fmt: 'csv', label: 'Excel/CSV', icon: FileSpreadsheet },
              { fmt: 'json', label: 'JSON', icon: Download },
            ] as const).map(({ fmt, label, icon: Icon }) => (
              <motion.button
                key={fmt}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  try {
                    const { data } = await api.get(`/users/export/directory?format=${fmt}${exportQuery}`, { responseType: fmt === 'csv' ? 'text' : 'json' });
                    const content = fmt === 'csv' ? data : JSON.stringify(fmt === 'json' ? data.data : data, null, 2);
                    const blob = new Blob([content], { type: fmt === 'csv' ? 'text/csv; charset=utf-8' : 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `member-directory.${fmt === 'csv' ? 'csv' : 'json'}`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Exported as ${label}`);
                  } catch { toast.error('Export failed'); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors text-foreground"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </motion.button>
            ))}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  const { data } = await api.get(`/users/export/directory?format=csv${exportQuery}`, { responseType: 'text' });
                  await downloadTablePdf(data, 'Member Directory', 'RDSWA-Member-Directory');
                  toast.success('PDF download started');
                } catch { toast.error('Export failed'); }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors text-foreground"
            >
              <FileText className="h-3.5 w-3.5" /> Download PDF
            </motion.button>
          </div>
        )}
      </div>

      <FadeIn direction="up" delay={0}>
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded-md bg-card text-foreground text-sm min-w-0">
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="member">Member</option>
              <option value="alumni">Alumni</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded-md bg-card text-foreground text-sm min-w-0">
              <option value="">All Status</option>
              <option value="none">No Application</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </FadeIn>

      {isAdmin && (
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4 p-3 rounded-lg border bg-primary/5 border-primary/20"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => bulkApproveMutation.mutate([...selectedIds])}
                  disabled={bulkApproveMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                  <UserCheck className="h-3 w-3" /> Approve
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Reject Selected Users', message: `Reject ${selectedIds.size} pending membership request${selectedIds.size > 1 ? 's' : ''}?`, confirmLabel: 'Reject', variant: 'danger' });
                    if (ok) bulkRejectMutation.mutate([...selectedIds]);
                  }}
                  disabled={bulkRejectMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                  <UserX className="h-3 w-3" /> Reject
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Mail className="h-3 w-3" /> Email
                </motion.button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>

              <AnimatePresence>
                {showEmailForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 overflow-hidden">
                    <input value={bulkEmail.subject} onChange={(e) => setBulkEmail({ ...bulkEmail, subject: e.target.value })}
                      placeholder="Email subject" className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                    <textarea value={bulkEmail.body} onChange={(e) => setBulkEmail({ ...bulkEmail, body: e.target.value })}
                      placeholder="Email body" rows={3} className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => bulkEmailMutation.mutate({ ids: [...selectedIds], subject: bulkEmail.subject, body: bulkEmail.body })}
                      disabled={!bulkEmail.subject.trim() || !bulkEmail.body.trim() || bulkEmailMutation.isPending}
                      className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50">
                      {bulkEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-muted border-b">
                    {isAdmin && (
                      <th className="p-3 w-8">
                        <input type="checkbox"
                          checked={users.length > 0 && users.every((u: any) => selectedIds.has(u._id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(users.map((u: any) => u._id)));
                            else setSelectedIds(new Set());
                          }}
                          className="rounded" />
                      </th>
                    )}
                    <th className="text-left p-3 font-medium text-foreground">User</th>
                    <th className="text-left p-3 font-medium text-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-foreground">Membership</th>
                    <th className="text-left p-3 font-medium text-foreground">Batch</th>
                    <th className="text-left p-3 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr
                      key={u._id}
                      className="border-t hover:bg-accent/30"
                    >
                      {isAdmin && (
                        <td className="p-3">
                          <input type="checkbox"
                            checked={selectedIds.has(u._id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(u._id);
                              else next.delete(u._id);
                              setSelectedIds(next);
                            }}
                            className="rounded" />
                        </td>
                      )}
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
                            <Link to={`/members/${u._id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                              {u.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {isAdmin ? (
                          <select value={u.role} onChange={(e) => changeRoleMutation.mutate({ id: u._id, role: e.target.value })}
                            className="px-2 py-1 border rounded text-xs bg-card text-foreground">
                            <option value="user">User</option>
                            <option value="member">Member</option>
                            <option value="alumni">Alumni</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-muted text-muted-foreground">
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          u.membershipStatus === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : u.membershipStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : u.membershipStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : u.membershipStatus === 'suspended' ? 'bg-muted text-muted-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {u.membershipStatus}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{u.batch || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Link to={`/members/${u._id}`} title="View Profile"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          {isSuperAdmin && (
                            <Link to={`/members/${u._id}?edit=true`} title="Edit Profile"
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}
                          {['pending', 'rejected', 'suspended'].includes(u.membershipStatus) && (
                            <button
                              onClick={() => approveMutation.mutate(u._id)}
                              title={u.membershipStatus === 'pending' ? 'Approve' : 'Reinstate'}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && u.membershipStatus === 'pending' && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({ title: 'Reject User', message: `Reject membership request from ${u.name}?`, confirmLabel: 'Reject', variant: 'danger' });
                                if (ok) rejectMutation.mutate(u._id);
                              }}
                              title="Reject"
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && u.membershipStatus !== 'suspended' && u.role !== 'super_admin' && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({ title: 'Suspend User', message: `Suspend ${u.name}'s account? They will not be able to log in until unsuspended.`, confirmLabel: 'Suspend', variant: 'warning' });
                                if (ok) suspendMutation.mutate(u._id);
                              }}
                              title="Suspend"
                              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && u.membershipStatus === 'approved' && (
                            <button
                              onClick={() => setAdvisorMutation.mutate({ id: u._id, grant: !u.isAdvisor })}
                              title={u.isAdvisor ? 'Revoke Advisor' : 'Grant Advisor'}
                              className={`p-1.5 rounded ${u.isAdvisor ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' : 'text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'}`}
                            >
                              <Award className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && u.membershipStatus === 'approved' && (
                            <button
                              onClick={() => setSeniorAdvisorMutation.mutate({ id: u._id, grant: !u.isSeniorAdvisor })}
                              title={u.isSeniorAdvisor ? 'Revoke Senior Advisor' : 'Grant Senior Advisor'}
                              className={`p-1.5 rounded ${u.isSeniorAdvisor ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                            >
                              <Star className="h-4 w-4" />
                            </button>
                          )}
                          {isSuperAdmin && u.role !== 'super_admin' && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete User',
                                  message: `Permanently delete ${u.name}'s account? This removes all their data and cannot be undone.`,
                                  confirmLabel: 'Delete',
                                  variant: 'danger',
                                  requireTypeToConfirm: 'DELETE',
                                });
                                if (ok) deleteUserMutation.mutate(u._id);
                              }}
                              title="Delete user"
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent text-foreground">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent text-foreground">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
