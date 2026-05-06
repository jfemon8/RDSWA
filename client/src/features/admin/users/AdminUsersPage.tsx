import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { Search, UserCheck, UserX, Ban, Download, FileText, FileSpreadsheet, Mail, Trash2, Award, Star, ExternalLink, Pencil, KeyRound, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadTablePdf } from '@/lib/downloadPdf';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser ? hasMinRole(currentUser.role, UserRole.ADMIN) : false;
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = usePageParam();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [bulkEmail, setBulkEmail] = useState({ subject: '', body: '' });
  // Force-password modal state — { user } when open, null when closed.
  const [forcePwdTarget, setForcePwdTarget] = useState<any | null>(null);

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

  // SuperAdmin only — force-set a user's password, overriding the current one.
  const forcePwdMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.patch(`/users/${id}/force-password`, { newPassword }),
    onSuccess: () => {
      toast.success('Password updated. The user has been notified.');
      setForcePwdTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to set password');
    },
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">User Management</h1>
        {isAdmin && (
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2 w-full sm:w-auto">
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
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors text-foreground whitespace-nowrap"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
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
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors text-foreground whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" /> PDF
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
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
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
        <Spinner size="md" />
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            {(() => {
              const renderRoleCell = (u: any) => (
                isAdmin && u.role !== 'super_admin' ? (
                  <select value={u.role} onChange={(e) => changeRoleMutation.mutate({ id: u._id, role: e.target.value })}
                    className="px-2 py-1 border rounded text-xs bg-card text-foreground max-w-full">
                    <option value="user">User</option>
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    {isSuperAdmin && <option value="admin">Admin</option>}
                  </select>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-muted text-muted-foreground whitespace-nowrap">
                    {u.role}
                  </span>
                )
              );
              const renderStatusBadge = (u: any) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                  u.membershipStatus === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : u.membershipStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : u.membershipStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {u.membershipStatus}
                </span>
              );
              const renderActions = (u: any) => (
                <div className="flex gap-1 flex-wrap">
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
                      onClick={() => setForcePwdTarget(u)}
                      title="Set password (override current)"
                      className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                    >
                      <KeyRound className="h-4 w-4" />
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
              );

              return (
                <>
                  {/* Desktop table */}
                  <div className="hidden lg:block border rounded-lg overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        {isAdmin && <col className="w-[40px]" />}
                        <col className="w-[28%]" />
                        <col className="w-[15%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                        <col />
                      </colgroup>
                      <thead>
                        <tr className="bg-muted border-b">
                          {isAdmin && (
                            <th className="p-3">
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
                          <tr key={u._id} className="border-t hover:bg-accent/30">
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
                              <div className="flex items-center gap-2 min-w-0">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                                    {u.name?.[0]}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <Link to={`/members/${u._id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate block">
                                    {u.name}
                                  </Link>
                                  <p className="text-xs text-muted-foreground truncate" title={u.email}>{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">{renderRoleCell(u)}</td>
                            <td className="p-3">{renderStatusBadge(u)}</td>
                            <td className="p-3 text-muted-foreground">{u.batch || '-'}</td>
                            <td className="p-3">{renderActions(u)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="lg:hidden space-y-3">
                    {isAdmin && users.length > 0 && (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/40 text-sm text-foreground cursor-pointer select-none">
                        <input type="checkbox"
                          checked={users.every((u: any) => selectedIds.has(u._id))}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(new Set(users.map((u: any) => u._id)));
                            else setSelectedIds(new Set());
                          }}
                          className="rounded" />
                        <span className="font-medium">Select all on this page</span>
                        {selectedIds.size > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {selectedIds.size} selected
                          </span>
                        )}
                      </label>
                    )}
                    {users.map((u: any) => (
                      <div key={u._id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-start gap-3 mb-3">
                          {isAdmin && (
                            <input type="checkbox"
                              checked={selectedIds.has(u._id)}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(u._id);
                                else next.delete(u._id);
                                setSelectedIds(next);
                              }}
                              className="rounded mt-1 shrink-0" />
                          )}
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                              {u.name?.[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link to={`/members/${u._id}`} className="font-medium text-foreground hover:text-primary transition-colors break-words">
                              {u.name}
                            </Link>
                            <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                            {u.batch && <p className="text-xs text-muted-foreground mt-0.5">Batch {u.batch}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {renderRoleCell(u)}
                          {renderStatusBadge(u)}
                        </div>
                        <div className="pt-2 border-t">
                          {renderActions(u)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </>
      )}

      {/* SuperAdmin force-password modal — overrides target user's password */}
      <ForcePasswordModal
        target={forcePwdTarget}
        onClose={() => setForcePwdTarget(null)}
        onSubmit={(newPassword) =>
          forcePwdMutation.mutate({ id: forcePwdTarget._id, newPassword })
        }
        isPending={forcePwdMutation.isPending}
      />
    </div>
  );
}

function ForcePasswordModal({
  target,
  onClose,
  onSubmit,
  isPending,
}: {
  target: any | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  isPending: boolean;
}) {
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  // Reset on close so a previous attempt doesn't leak into the next one.
  const open = !!target;
  useEffect(() => {
    if (!open) {
      setPwd('');
      setConfirmPwd('');
      setError('');
      setShow(false);
    }
  }, [open]);

  const handleSubmit = () => {
    setError('');
    if (pwd.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (pwd !== confirmPwd) { setError('Passwords do not match'); return; }
    onSubmit(pwd);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="bg-card border rounded-lg w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                Set Password
              </h2>
              <button onClick={onClose} className="p-1 hover:bg-accent rounded" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              You are setting a new password for <span className="font-medium text-foreground">{target?.name}</span>
              {' '}(<span className="font-mono break-all">{target?.email}</span>). Their existing password will be overridden immediately. They will be notified by email and in-app.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">New password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={pwd}
                    onChange={(e) => { setPwd(e.target.value); setError(''); }}
                    autoFocus
                    minLength={6}
                    className="w-full px-3 py-2 pr-9 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm password</label>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); setError(''); }}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="Re-enter the password"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !pwd || !confirmPwd}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Set Password
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
