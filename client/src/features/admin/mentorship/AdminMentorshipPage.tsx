import { Fragment, useState } from 'react';
import { CardListSkeleton, RecordsSkeleton } from '@/components/ui/Skeleton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAccordionToggle } from '@/hooks/useAccordionScroll';
import { useConfirm, usePrompt } from '@/components/ui/ConfirmModal';
import { useTabParam } from '@/hooks/useTabParam';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import {
  Trash2, Search, Download, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  MessageSquare, UserPlus, Clock, Users, HeartHandshake, AlertTriangle, X,
} from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-muted text-muted-foreground',
};

type Tab = 'pairings' | 'mentors';
const TABS: readonly Tab[] = ['pairings', 'mentors'];

export default function AdminMentorshipPage() {
  const [tab, setTab] = useTabParam<Tab>(TABS, 'pairings');
  const { user } = useAuthStore();
  const canManage = user?.role ? hasMinRole(user.role, UserRole.ADMIN) : false;

  const { data: statsData } = useQuery({
    queryKey: ['admin-mentorships', 'stats'],
    queryFn: async () => (await api.get('/mentorships/admin/stats')).data,
  });
  const stats = statsData?.data;

  const cards = [
    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-yellow-600' },
    { label: 'Active', value: stats?.active ?? 0, icon: HeartHandshake, color: 'text-green-600' },
    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle2, color: 'text-blue-600' },
    {
      label: `Stalled ${stats?.staleRequestDays ? `(${stats.staleRequestDays}d+)` : ''}`.trim(),
      value: stats?.stalePending ?? 0,
      icon: AlertTriangle,
      color: (stats?.stalePending ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-foreground">Mentorship Management</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <FadeIn key={c.label} direction="up" delay={i * 0.05}>
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {stats?.topMentors?.length > 0 && (
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg p-4 bg-card mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-2">Busiest mentors</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topMentors.map((m: any) => (
                <Link key={m._id} to={`/members/${m._id}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs hover:bg-accent transition-colors">
                  <span className="text-foreground">{m.name}</span>
                  <span className="text-muted-foreground">{m.count} active</span>
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'pairings' ? 'Pairings' : 'Mentor Roster'}
          </button>
        ))}
      </div>

      {tab === 'pairings' ? <PairingsTab canManage={canManage} /> : <MentorRosterTab canManage={canManage} />}
    </div>
  );
}

function PairingsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = useAccordionToggle(expandedId, setExpandedId);
  const [showMatch, setShowMatch] = useState(false);

  const { data: configData } = useQuery({
    queryKey: ['mentorship-config'],
    queryFn: async () => (await api.get('/mentorships/config')).data,
    staleTime: 5 * 60_000,
  });
  const areas: string[] = configData?.data?.areas || [];

  const filters = { status: statusFilter, area: areaFilter, search: debouncedSearch };

  const {
    items: mentorships,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: ['admin-mentorships', statusFilter, areaFilter, debouncedSearch],
    path: '/mentorships/admin/all',
    filters,
    limit: 20,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-mentorships'] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mentorships/${id}`),
    onSuccess: () => { refresh(); toast.success('Mentorship deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: 'completed' | 'cancelled'; reason?: string }) =>
      api.patch(`/mentorships/admin/${vars.id}/status`, { status: vars.status, reason: vars.reason }),
    onSuccess: (_d, vars) => { refresh(); toast.success(`Mentorship ${vars.status}`); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const forceStatus = async (m: any, status: 'completed' | 'cancelled') => {
    const reason = await prompt({
      title: status === 'completed' ? 'Complete Mentorship' : 'Cancel Mentorship',
      message: 'Both the mentor and the mentee are notified, and the reason is shown to them.',
      label: 'Reason (optional)',
      placeholder: status === 'completed' ? 'e.g. Goals met' : 'e.g. Mentor is unavailable',
      confirmLabel: status === 'completed' ? 'Mark completed' : 'Cancel mentorship',
      variant: status === 'completed' ? 'info' : 'warning',
      multiline: true,
    });
    if (reason === null) return;
    statusMutation.mutate({ id: m._id, status, reason: reason || undefined });
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (areaFilter) params.set('area', areaFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    window.open(`${api.defaults.baseURL}/mentorships/admin/export?${params}`, '_blank');
  };

  const renderStatus = (m: any) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${STATUS_COLORS[m.status] || 'bg-muted text-muted-foreground'}`}>
      {m.status}
    </span>
  );

  const renderActions = (m: any) => (
    <div className="flex items-center justify-end gap-1">
      {canManage && m.status === 'active' && (
        <button onClick={() => forceStatus(m, 'completed')} title="Mark completed"
          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}
      {canManage && (m.status === 'active' || m.status === 'pending') && (
        <button onClick={() => forceStatus(m, 'cancelled')} title="Cancel mentorship"
          className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded">
          <XCircle className="h-4 w-4" />
        </button>
      )}
      {m.consultationGroup && (
        <Link to={`/dashboard/groups/${m.consultationGroup}`} title="Consultation group"
          className="p-1.5 text-primary hover:bg-primary/10 rounded">
          <MessageSquare className="h-4 w-4" />
        </Link>
      )}
      {canManage && (
        <button onClick={async () => {
          const ok = await confirm({ title: 'Delete Mentorship', message: 'Delete this mentorship record? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
          if (ok) deleteMutation.mutate(m._id);
        }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={() => toggleExpand(m._id)}
        title={expandedId === m._id ? 'Hide details' : 'View details'}
        aria-expanded={expandedId === m._id}
        className="p-1.5 text-muted-foreground hover:bg-accent rounded"
      >
        {expandedId === m._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
    </div>
  );

  /** The timeline and context the table has no column for. */
  const renderDetails = (m: any) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground text-left">
      <span>Area: {m.area || 'Not specified'}</span>
      <span>Requested: {formatDate(m.requestedAt || m.createdAt)}</span>
      <span>Accepted: {m.acceptedAt ? formatDate(m.acceptedAt) : '-'}</span>
      <span>Completed: {m.completedAt ? formatDate(m.completedAt) : '-'}</span>
      {m.mentor?.department && <span>Mentor dept: {m.mentor.department}</span>}
      {m.mentor?.profession && <span>Mentor works as: {m.mentor.profession}</span>}
      {m.mentee?.department && <span>Mentee dept: {m.mentee.department}</span>}
      {m.mentee?.batch && <span>Mentee batch: {m.mentee.batch}</span>}
      {m.closedBy?.name && <span className="basis-full">Closed by {m.closedBy.name}</span>}
      {m.closeReason && <span className="basis-full break-words">Reason: {m.closeReason}</span>}
    </div>
  );

  return (
    <>
      <FadeIn direction="up">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mentor or mentee..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border rounded-md bg-card text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border rounded-md bg-card text-sm">
            <option value="">All Areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {canManage && (
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button onClick={() => setShowMatch(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 whitespace-nowrap">
                <UserPlus className="h-4 w-4 shrink-0" /> Match
              </button>
              <button onClick={exportCsv}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border rounded-md text-sm hover:bg-accent whitespace-nowrap">
                <Download className="h-4 w-4 shrink-0" /> CSV
              </button>
            </div>
          )}
        </div>
      </FadeIn>

      <AnimatePresence>
        {showMatch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <MatchForm areas={areas} onClose={() => setShowMatch(false)} onDone={refresh} />
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <RecordsSkeleton />
      ) : mentorships.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No mentorships found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          {/* Desktop table */}
          <div className="hidden lg:block border rounded-lg overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-[860px]">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Mentor</th>
                  <th className="text-left p-3 font-medium">Mentee</th>
                  <th className="text-left p-3 font-medium">Area</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Requested</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mentorships.map((m: any) => (
                  <Fragment key={m._id}>
                    <tr data-accordion-item={m._id} className="border-t hover:bg-accent/30">
                      <td className="p-3 truncate">
                        <Link to={`/members/${m.mentor?._id}`} className="font-medium hover:text-primary transition-colors truncate block" title={m.mentor?.name}>{m.mentor?.name || '-'}</Link>
                      </td>
                      <td className="p-3 truncate">
                        <Link to={`/members/${m.mentee?._id}`} className="hover:text-primary transition-colors truncate block" title={m.mentee?.name}>{m.mentee?.name || '-'}</Link>
                      </td>
                      <td className="p-3 text-muted-foreground truncate" title={m.area || ''}>{m.area || '-'}</td>
                      <td className="p-3">{renderStatus(m)}</td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.requestedAt || m.createdAt)}</td>
                      <td className="p-3">{renderActions(m)}</td>
                    </tr>

                    {/* A row of its own, because an extra cell here would fall outside the six fixed columns. */}
                    <tr>
                      <td colSpan={6} className="p-0">
                        <AnimatePresence initial={false}>
                          {expandedId === m._id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 py-2 border-t bg-muted/30">{renderDetails(m)}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {mentorships.map((m: any) => (
              <div key={m._id} data-accordion-item={m._id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground mb-0.5">Mentor</div>
                    <Link to={`/members/${m.mentor?._id}`} className="font-medium hover:text-primary transition-colors break-words">{m.mentor?.name || '-'}</Link>
                  </div>
                  {renderStatus(m)}
                </div>
                <div className="mb-2">
                  <div className="text-xs text-muted-foreground">Mentee</div>
                  <Link to={`/members/${m.mentee?._id}`} className="hover:text-primary transition-colors break-words">{m.mentee?.name || '-'}</Link>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                  {m.area && <span>{m.area}</span>}
                  <span>{formatDate(m.requestedAt || m.createdAt)}</span>
                </div>
                <div className="pt-2 border-t">{renderActions(m)}</div>
                <AnimatePresence initial={false}>
                  {expandedId === m._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2">{renderDetails(m)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <InfiniteScrollSentinel
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        endLabel={mentorships.length > 0 ? `All ${total} mentorships loaded` : undefined}
      />
    </>
  );
}

/** Pair two members directly, for a request that never found its way through the normal flow. */
function MatchForm({ areas, onClose, onDone }: { areas: string[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [mentor, setMentor] = useState<{ _id: string; name: string } | null>(null);
  const [mentee, setMentee] = useState<{ _id: string; name: string } | null>(null);
  const [area, setArea] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/mentorships/admin/match', {
      mentorId: mentor?._id,
      menteeId: mentee?._id,
      area: area || undefined,
    }),
    onSuccess: () => {
      onDone();
      onClose();
      toast.success('Mentorship created');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create mentorship'),
  });

  return (
    <div className="border rounded-lg p-4 bg-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground text-sm">Pair a mentor with a mentee</h3>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UserPicker label="Mentor" selected={mentor} onSelect={setMentor} />
        <UserPicker label="Mentee" selected={mentee} onSelect={setMentee} />
      </div>
      <div className="mt-3">
        <label className="text-xs text-muted-foreground mb-1 block">Area</label>
        <select value={area} onChange={(e) => setArea(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm">
          <option value="">Not specified</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        The pairing starts active and both members are notified, so use it only once they have agreed.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={!mentor || !mentee || mutation.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating...' : 'Create mentorship'}
        </button>
        <button onClick={onClose} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
      </div>
    </div>
  );
}

function UserPicker({ label, selected, onSelect }: {
  label: string;
  selected: { _id: string; name: string } | null;
  onSelect: (u: { _id: string; name: string } | null) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);

  const { data } = useQuery({
    queryKey: ['users', 'mentorship-picker', debounced],
    queryFn: async () => (await api.get(`/users?search=${debounced}&limit=8`)).data,
    enabled: debounced.length >= 2,
  });
  const results = data?.data || [];

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border rounded-md bg-muted/40">
          <span className="text-sm text-foreground truncate">{selected.name}</span>
          <button type="button" onClick={() => { onSelect(null); setSearch(''); }} className="p-1 rounded hover:bg-accent shrink-0" aria-label={`Clear ${label}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
          />
          {debounced.length >= 2 && results.length > 0 && (
            <div className="border rounded-md max-h-32 overflow-y-auto bg-card mt-1">
              {results.map((u: any) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => onSelect({ _id: u._id, name: u.name })}
                  className="w-full text-left px-3 py-1.5 text-xs border-b last:border-b-0 hover:bg-accent"
                >
                  <span className="text-foreground">{u.name}</span> <span className="text-muted-foreground">({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Who is eligible to mentor, who has opted in, and how much each is carrying. */
function MentorRosterTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [optedInOnly, setOptedInOnly] = useState(false);

  const {
    items: mentors,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: ['admin-mentor-roster', debouncedSearch, String(optedInOnly)],
    path: '/mentorships/admin/mentors',
    filters: { search: debouncedSearch, optedIn: optedInOnly ? 'true' : '' },
    limit: 20,
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { userId: string; isMentor: boolean }) =>
      api.patch(`/mentorships/admin/mentors/${vars.userId}`, { isMentor: vars.isMentor }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mentor-roster'] });
      queryClient.invalidateQueries({ queryKey: ['admin-mentorships'] });
      toast.success(vars.isMentor ? 'Listed as mentor' : 'Mentor listing paused');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <>
      <FadeIn direction="up">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..." className="w-full pl-10 pr-3 py-2 border rounded-md bg-card text-sm" />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card text-sm cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={optedInOnly} onChange={(e) => setOptedInOnly(e.target.checked)} className="rounded border-input" />
            Listed mentors only
          </label>
        </div>
      </FadeIn>

      {isLoading ? (
        <CardListSkeleton />
      ) : mentors.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No eligible members found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mentors.map((m: any) => (
              <div key={m._id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/members/${m._id}`} className="font-medium text-foreground hover:text-primary transition-colors break-words">{m.name}</Link>
                    <p className="text-xs text-muted-foreground break-words">
                      {[m.department, m.profession].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    m.isMentor
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {m.isMentor ? 'Listed' : 'Not listed'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {m.active} active</span>
                  <span>{m.pending} pending</span>
                  <span>{m.completed} completed</span>
                  {m.atCapacity && (
                    <span className="text-red-600 font-medium">At capacity ({m.maxActiveMentees})</span>
                  )}
                </div>

                {m.mentorAreas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.mentorAreas.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">{a}</span>
                    ))}
                  </div>
                )}

                {canManage && (
                  <button
                    onClick={() => toggleMutation.mutate({ userId: m._id, isMentor: !m.isMentor })}
                    disabled={toggleMutation.isPending}
                    className={`mt-3 w-full px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                      m.isMentor
                        ? 'border hover:bg-accent text-foreground'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {m.isMentor ? 'Pause listing' : 'List as mentor'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <InfiniteScrollSentinel
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        endLabel={mentors.length > 0 ? `All ${total} members loaded` : undefined}
      />
    </>
  );
}
