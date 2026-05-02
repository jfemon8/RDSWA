import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { Loader2, UserMinus, Search, Plus, X, Briefcase, Building2 } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

/** Which boolean flag this page manages */
type TagFlag = 'isAlumni' | 'isAdvisor' | 'isSeniorAdvisor';

/** Which backend endpoint to call for grant/revoke */
type TagEndpoint = 'alumni' | 'advisor' | 'senior-advisor';

export interface AdminRoleTagManagerPageProps {
  /** Heading title — e.g. "Alumni Management" */
  title: string;
  /** Intro paragraph shown at the top */
  description: string;
  /** Filter flag for listing users currently holding the tag */
  flagFilter: TagFlag;
  /** REST endpoint segment for grant/revoke — e.g. 'alumni' → PATCH /users/:id/alumni */
  endpoint: TagEndpoint;
  /** Heading icon */
  icon: LucideIcon;
  /** Tailwind text color for the icon */
  iconColor: string;
  /** Tailwind bg color for the avatar placeholder */
  avatarBg: string;
  /** Tailwind text color for the avatar placeholder */
  avatarText: string;
  /** Short label used in toasts + empty state, e.g. "alumni" / "advisor" / "senior advisor" */
  roleLabel: string;
  /** Short pluralized label, e.g. "alumni" / "advisors" / "senior advisors" */
  roleLabelPlural: string;
  /**
   * For Alumni pages only — show the user's current employment (job/business) inline on each
   * card so the admin can see *why* they were auto-tagged. Does not affect revoke behavior;
   * any user holding the tag can be revoked from any of these management pages.
   */
  showEmploymentInfo?: boolean;
  /**
   * When true, the candidate search returns ALL users (not just approved members).
   * Use this for tags that any user can hold regardless of membership status
   * (e.g. Senior Advisor). Default: false (approved-members-only).
   */
  allowAnyUser?: boolean;
}

/**
 * Reusable admin page for managing a boolean role-tag (isAlumni / isAdvisor / isSeniorAdvisor).
 *
 * Layout:
 *  - Title + intro
 *  - "Add" button → expandable search panel for approved members NOT currently holding the tag
 *  - List of users currently holding the tag with a revoke button on each card
 *  - Pagination
 */
export default function AdminRoleTagManagerPage({
  title,
  description,
  flagFilter,
  endpoint,
  icon: Icon,
  iconColor,
  avatarBg,
  avatarText,
  roleLabel,
  roleLabelPlural,
  showEmploymentInfo = false,
  allowAnyUser = false,
}: AdminRoleTagManagerPageProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = usePageParam();
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', `tag-manager-${flagFilter}`, page],
    queryFn: async () => {
      const { data } = await api.get(`/users?${flagFilter}=true&limit=20&page=${page}`);
      return data;
    },
  });

  // Search candidate users who do NOT yet have this tag — for the "add" panel.
  // When allowAnyUser is true, search across ALL users; otherwise restrict to approved members.
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ['users', `tag-candidates-${flagFilter}`, addSearch, allowAnyUser],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10' });
      if (!allowAnyUser) params.set('membershipStatus', 'approved');
      if (addSearch) params.set('search', addSearch);
      const { data } = await api.get(`/users?${params}`);
      return data;
    },
    enabled: showAdd,
  });

  const grantMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/${endpoint}`, { grant: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${roleLabel} granted`);
      setAddSearch('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to grant'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/${endpoint}`, { grant: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${roleLabel} revoked`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to revoke'),
  });

  const users = data?.data || [];
  const pagination = data?.pagination;
  const candidates = (candidatesData?.data || []).filter(
    (u: any) => !u[flagFilter]
  );

  const handleRevoke = async (u: any) => {
    const ok = await confirm({
      title: `Revoke ${roleLabel}`,
      message: `Remove ${u.name} from the ${roleLabel} list? They will remain a member.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    });
    if (ok) revokeMutation.mutate(u._id);
  };

  return (
    <FadeIn direction="up">
      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowAdd((v) => !v); setAddSearch(''); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium min-h-[40px]"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? 'Close' : `Add ${roleLabel}`}
          </motion.button>
        </div>

        <FadeIn delay={0.08}>
          <div className={`mb-4 p-3 rounded-lg border text-sm ${iconColor.replace('text-', 'border-').replace('-500', '-200').replace('-600', '-200')} bg-muted/30 text-muted-foreground`}>
            {description}
          </div>
        </FadeIn>

        {/* Add panel */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="border rounded-xl p-4 bg-card">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder={
                      allowAnyUser
                        ? 'Search any user by name, email, or student ID...'
                        : 'Search approved members by name, email, or student ID...'
                    }
                    className="w-full pl-10 pr-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
                {candidatesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {addSearch
                      ? `No ${allowAnyUser ? 'users' : 'approved members'} found matching "${addSearch}"`
                      : `Start typing to find ${allowAnyUser ? 'users' : 'approved members'}`}
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-80 overflow-y-auto">
                    {candidates.map((u: any) => (
                      <li
                        key={u._id}
                        className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className={`h-8 w-8 rounded-full ${avatarBg} ${avatarText} flex items-center justify-center font-medium text-xs shrink-0`}>
                              {u.name?.[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => grantMutation.mutate(u._id)}
                          disabled={grantMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
                        >
                          <Plus className="h-3 w-3" /> Grant
                        </motion.button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main list */}
        {isLoading ? (
          <Spinner size="md" />
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Icon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No {roleLabelPlural} found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {users.map((u: any, i: number) => {
                const currentJob = u.jobHistory?.find((j: any) => j.isCurrent);
                const currentBiz = u.businessInfo?.find((b: any) => b.isCurrent);
                // For alumni: label the source so admin understands why they're tagged
                const sourceLabel = showEmploymentInfo
                  ? (u.alumniApproved ? 'Manually approved' : 'Auto-tagged from employment')
                  : null;

                return (
                  <FadeIn key={u._id} delay={i * 0.04} direction="up">
                    <div className="border rounded-lg p-4 bg-card">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <Link
                          to={`/members/${u._id}`}
                          className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className={`h-10 w-10 rounded-full ${avatarBg} ${avatarText} flex items-center justify-center font-medium text-sm shrink-0`}>
                              {u.name?.[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{u.nickName || u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              {u.batch && <span>Batch {u.batch}</span>}
                              {u.department && <span>· {u.department}</span>}
                              {sourceLabel && <span className="italic">· {sourceLabel}</span>}
                            </div>
                          </div>
                        </Link>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRevoke(u)}
                          disabled={revokeMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 shrink-0"
                        >
                          <UserMinus className="h-3 w-3" /> Revoke
                        </motion.button>
                      </div>

                      {showEmploymentInfo && (currentJob || currentBiz) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {currentJob && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                              <Briefcase className="h-3 w-3 shrink-0" /> {currentJob.position} at {currentJob.company}
                            </span>
                          )}
                          {currentBiz && (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded">
                              <Building2 className="h-3 w-3 shrink-0" /> {currentBiz.businessName} ({currentBiz.type})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
            )}
          </>
        )}
      </div>
    </FadeIn>
  );
}
