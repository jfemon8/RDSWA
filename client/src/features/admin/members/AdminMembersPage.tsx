import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Ban, ExternalLink, Users, Clock, ShieldOff, Mail, Award, Star, UserCog, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FadeIn, BlurText, SpotlightCard } from '@/components/reactbits';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import SEO from '@/components/SEO';
import { downloadTablePdf } from '@/lib/downloadPdf';

type MemberStats = { approved: number; pending: number; suspended: number };

export default function AdminMembersPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser ? hasMinRole(currentUser.role, UserRole.ADMIN) : false;
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [bulkEmail, setBulkEmail] = useState({ subject: '', body: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters: Record<string, string> = {
    page: String(page),
    limit: '20',
    membershipStatus: 'approved',
  };
  if (search) filters.search = search;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.members(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/users?${params}`);
      return data;
    },
  });

  const { data: statsData } = useQuery<MemberStats>({
    queryKey: ['admin', 'members', 'stats'],
    queryFn: async () => {
      const [approved, pending, suspended] = await Promise.all([
        api.get('/users?membershipStatus=approved&limit=1'),
        api.get('/users?membershipStatus=pending&limit=1'),
        api.get('/users?membershipStatus=suspended&limit=1'),
      ]);
      return {
        approved: approved.data?.pagination?.total ?? 0,
        pending: pending.data?.pagination?.total ?? 0,
        suspended: suspended.data?.pagination?.total ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const { data: academicConfig } = useQuery({
    queryKey: ['academic-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/academic-config');
      return data.data;
    },
    staleTime: 5 * 60_000,
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/suspend`, { reason: 'Suspended by admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'members', 'stats'] });
      toast.success('Member suspended');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to suspend member'); },
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

  const bulkEmailMutation = useMutation({
    mutationFn: ({ ids, subject, body }: { ids: string[]; subject: string; body: string }) =>
      api.post('/admin/bulk/email', { userIds: ids, subject, body }),
    onSuccess: (res: any) => {
      setSelectedIds(new Set());
      setShowBulkEmail(false);
      setBulkEmail({ subject: '', body: '' });
      toast.success(res.data?.message || 'Emails sent');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Bulk email failed'); },
  });

  const members: any[] = data?.data || [];
  const pagination = data?.pagination;

  const exportParams = new URLSearchParams();
  exportParams.set('membershipStatus', 'approved');
  if (search) exportParams.set('search', search);
  if (batch) exportParams.set('batch', batch);
  if (department) exportParams.set('department', department);

  const handleExport = async (fmt: 'csv' | 'json' | 'pdf') => {
    try {
      const ext = fmt === 'pdf' ? 'csv' : fmt;
      const { data } = await api.get(`/users/export/directory?format=${ext}&${exportParams}`, {
        responseType: ext === 'csv' ? 'text' : 'json',
      });
      if (fmt === 'pdf') {
        await downloadTablePdf(data, 'Member Directory', 'RDSWA-Members');
        toast.success('PDF download started');
        return;
      }
      const content = fmt === 'csv' ? data : JSON.stringify(fmt === 'json' ? data.data : data, null, 2);
      const blob = new Blob([content], { type: fmt === 'csv' ? 'text/csv; charset=utf-8' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `members.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${fmt.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(members.map((m) => m._id)));
    else setSelectedIds(new Set());
  };

  const stats = [
    { label: 'Active Members', value: statsData?.approved ?? 0, icon: Users, color: 'rgba(34, 197, 94, 0.15)' },
    { label: 'Pending Requests', value: statsData?.pending ?? 0, icon: Clock, color: 'rgba(234, 179, 8, 0.15)' },
    { label: 'Suspended', value: statsData?.suspended ?? 0, icon: ShieldOff, color: 'rgba(239, 68, 68, 0.15)' },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <SEO title="Member Management" description="Manage active members of RDSWA." />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div>
          <BlurText
            text="Member Management"
            className="text-xl sm:text-2xl font-bold mb-1"
            delay={60}
            animateBy="words"
            direction="bottom"
          />
          <p className="text-sm text-muted-foreground">Manage and review approved members of RDSWA.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { fmt: 'csv', label: 'CSV', icon: FileSpreadsheet },
            { fmt: 'json', label: 'JSON', icon: Download },
            { fmt: 'pdf', label: 'PDF', icon: FileText },
          ] as const).map(({ fmt, label, icon: Icon }) => (
            <motion.button
              key={fmt}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleExport(fmt)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-accent transition-colors text-foreground"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <FadeIn key={s.label} direction="up" delay={i * 0.06}>
              <SpotlightCard className="bg-card border-border p-5" spotlightColor={s.color}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                  </div>
                </div>
              </SpotlightCard>
            </FadeIn>
          );
        })}
      </div>

      {/* Filters */}
      <FadeIn direction="up" delay={0.15}>
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, student ID..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <select
              value={batch}
              onChange={(e) => { setBatch(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded-md bg-card text-foreground text-sm min-w-0"
            >
              <option value="">All Batches</option>
              {(academicConfig?.batches || []).map((b: string) => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
              className="px-3 py-2 border rounded-md bg-card text-foreground text-sm min-w-0"
            >
              <option value="">All Departments</option>
              {(academicConfig?.faculties || []).flatMap((f: any) => f.departments || []).map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </FadeIn>

      {/* Bulk actions */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mb-4 p-3 rounded-lg border bg-primary/5 border-primary/20 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowBulkEmail(!showBulkEmail)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Mail className="h-3 w-3" /> Email
              </motion.button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
            </div>
            <AnimatePresence>
              {showBulkEmail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <input
                    value={bulkEmail.subject}
                    onChange={(e) => setBulkEmail({ ...bulkEmail, subject: e.target.value })}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  />
                  <textarea
                    value={bulkEmail.body}
                    onChange={(e) => setBulkEmail({ ...bulkEmail, body: e.target.value })}
                    placeholder="Email body"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => bulkEmailMutation.mutate({ ids: [...selectedIds], subject: bulkEmail.subject, body: bulkEmail.body })}
                    disabled={!bulkEmail.subject.trim() || !bulkEmail.body.trim() || bulkEmailMutation.isPending}
                    className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                  >
                    {bulkEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : members.length === 0 ? (
        <FadeIn direction="up" delay={0.2}>
          <div className="text-center py-12 border rounded-xl bg-card">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No approved members match your filters.</p>
            <Link to="/admin/users" className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2">
              <UserCog className="h-4 w-4" /> Review all users
            </Link>
          </div>
        </FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.2}>
          {/* Desktop table */}
          <div className="hidden lg:block border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[40px]" />
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="bg-muted border-b">
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && members.every((m) => selectedIds.has(m._id))}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-3 font-medium text-foreground">Member</th>
                  <th className="text-left p-3 font-medium text-foreground">Department</th>
                  <th className="text-left p-3 font-medium text-foreground">Batch</th>
                  <th className="text-left p-3 font-medium text-foreground">Tags</th>
                  <th className="text-left p-3 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {members.map((m) => (
                    <motion.tr
                      key={m._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-t hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m._id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(m._id);
                            else next.delete(m._id);
                            setSelectedIds(next);
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {m.avatar ? (
                            <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                              {m.name?.[0]}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link to={`/members/${m._id}`} className="font-medium text-foreground hover:text-primary transition-colors truncate block">
                              {m.name}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate" title={m.email}>{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground truncate" title={m.department || ''}>{m.department || '-'}</td>
                      <td className="p-3 text-muted-foreground">{m.batch || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {m.isAlumni && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Alumni</span>}
                          {m.isAdvisor && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">Advisor</span>}
                          {m.isSeniorAdvisor && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Senior</span>}
                          {!m.isAlumni && !m.isAdvisor && !m.isSeniorAdvisor && <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          <Link
                            to={`/members/${m._id}`}
                            title="View Profile"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => setAdvisorMutation.mutate({ id: m._id, grant: !m.isAdvisor })}
                              title={m.isAdvisor ? 'Revoke Advisor' : 'Grant Advisor'}
                              className={`p-1.5 rounded ${m.isAdvisor ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' : 'text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'}`}
                            >
                              <Award className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setSeniorAdvisorMutation.mutate({ id: m._id, grant: !m.isSeniorAdvisor })}
                              title={m.isSeniorAdvisor ? 'Revoke Senior Advisor' : 'Grant Senior Advisor'}
                              className={`p-1.5 rounded ${m.isSeniorAdvisor ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                            >
                              <Star className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && m.role !== 'super_admin' && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Suspend Member',
                                  message: `Suspend ${m.name}'s account? They will not be able to log in until unsuspended.`,
                                  confirmLabel: 'Suspend',
                                  variant: 'warning',
                                });
                                if (ok) suspendMutation.mutate(m._id);
                              }}
                              title="Suspend"
                              className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {members.length > 0 && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/40 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={members.every((m) => selectedIds.has(m._id))}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded"
                />
                <span className="font-medium">Select all on this page</span>
                {selectedIds.size > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{selectedIds.size} selected</span>
                )}
              </label>
            )}
            {members.map((m) => (
              <motion.div
                key={m._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg p-4 bg-card"
              >
                <div className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m._id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) next.add(m._id);
                      else next.delete(m._id);
                      setSelectedIds(next);
                    }}
                    className="rounded mt-1 shrink-0"
                  />
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                      {m.name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link to={`/members/${m._id}`} className="font-medium text-foreground hover:text-primary break-words">
                      {m.name}
                    </Link>
                    <p className="text-xs text-muted-foreground break-all">{m.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.department || '-'}{m.batch ? ` • Batch ${m.batch}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {m.isAlumni && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Alumni</span>}
                  {m.isAdvisor && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">Advisor</span>}
                  {m.isSeniorAdvisor && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Senior Advisor</span>}
                </div>
                <div className="pt-2 border-t flex gap-1 flex-wrap">
                  <Link to={`/members/${m._id}`} title="View Profile" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={() => setAdvisorMutation.mutate({ id: m._id, grant: !m.isAdvisor })}
                      className={`p-1.5 rounded ${m.isAdvisor ? 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' : 'text-muted-foreground hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'}`}
                    >
                      <Award className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setSeniorAdvisorMutation.mutate({ id: m._id, grant: !m.isSeniorAdvisor })}
                      className={`p-1.5 rounded ${m.isSeniorAdvisor ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && m.role !== 'super_admin' && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Suspend Member',
                          message: `Suspend ${m.name}'s account? They will not be able to log in until unsuspended.`,
                          confirmLabel: 'Suspend',
                          variant: 'warning',
                        });
                        if (ok) suspendMutation.mutate(m._id);
                      }}
                      className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </FadeIn>
      )}
    </div>
  );
}
