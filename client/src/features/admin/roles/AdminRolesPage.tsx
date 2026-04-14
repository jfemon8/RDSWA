import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import {
  Shield, Check, X, History, Loader2, ArrowRight,
  GraduationCap, Award, Star, Zap,
} from 'lucide-react';
import { UserRole, TIER_HIERARCHY, PERMISSIONS, Module, Action, TAG_ROLES } from '@rdswa/shared';
import api from '@/lib/api';
import { formatDate } from '@/lib/date';

const ROLE_COLORS: Record<string, string> = {
  guest: 'bg-muted text-muted-foreground',
  user: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  member: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  moderator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  alumni: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  advisor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  senior_advisor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  guest: 'Unauthenticated visitors with read-only public access',
  user: 'Registered users who haven\'t been approved as members',
  member: 'Approved RDSWA members with full platform access',
  moderator: 'Content moderation, user approval, basic reports, form review. Auto-assigned to OS & Treasurer of current committee, and Ex-President & Ex-GS of previous committee.',
  admin: 'Full management access: finance, votes, bus schedules, user management, all reports. Auto-assigned to President & GS of current committee.',
  super_admin: 'Unrestricted system access: settings, backup, admin management, email broadcast. Hardcoded to specific emails.',
};

const TAG_DESCRIPTIONS: Record<string, { label: string; description: string; icon: typeof GraduationCap; color: string }> = {
  alumni: {
    label: 'Alumni',
    description: 'Graduated members with continued access. Auto-tagged or manually assigned.',
    icon: GraduationCap,
    color: 'text-amber-500',
  },
  advisor: {
    label: 'Advisor',
    description: 'Auto-granted to Ex-Presidents & Ex-GS when committee archives. Can also be manually assigned.',
    icon: Award,
    color: 'text-teal-500',
  },
  senior_advisor: {
    label: 'Senior Advisor',
    description: 'Elevated advisory status. Manual assignment only by Admin or SuperAdmin.',
    icon: Star,
    color: 'text-indigo-500',
  },
};

const AUTO_ASSIGNMENT_INFO = [
  { role: 'Admin', positions: 'President, General Secretary', committee: 'Current', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  { role: 'Moderator', positions: 'Organizing Secretary, Treasurer', committee: 'Current', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { role: 'Moderator', positions: 'Ex-President, Ex-General Secretary', committee: 'Previous (archived)', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
];

const modules = Object.values(Module);
const actions = Object.values(Action);
const displayRoles = TIER_HIERARCHY.filter(r => r !== UserRole.GUEST);

export default function AdminRolesPage() {
  return (
    <div className="container mx-auto space-y-8 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Role Management</h1>

      {/* Role Hierarchy — tier roles only */}
      <FadeIn direction="up" delay={0.1}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg text-foreground">Role Hierarchy</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Privilege-based roles ordered by access level. Higher roles inherit all permissions of lower roles.
          </p>
          <div className="flex flex-wrap gap-3">
            {TIER_HIERARCHY.map((role, i) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
                className="flex items-center gap-2"
              >
                <div className={`px-3 py-2 rounded-lg text-sm font-medium capitalize ${ROLE_COLORS[role]}`}>
                  {role.replace('_', ' ')}
                </div>
                {i < TIER_HIERARCHY.length - 1 && (
                  <span className="text-muted-foreground text-lg">→</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Role Details — tier roles */}
      <FadeIn direction="up" delay={0.2}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h2 className="font-semibold text-lg mb-4 text-foreground">Tier Roles</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Each user has exactly one tier role that determines their privilege level.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {TIER_HIERARCHY.map((role, i) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="border rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold capitalize ${ROLE_COLORS[role]}`}>
                    {role.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">Level {i + 1}</span>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{ROLE_DESCRIPTIONS[role]}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Tag Roles — orthogonal flags */}
      <FadeIn direction="up" delay={0.25}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h2 className="font-semibold text-lg mb-4 text-foreground">Tag Roles</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Orthogonal boolean flags that can be assigned alongside any tier role. These do not affect privilege level.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TAG_ROLES.map((role, i) => {
              const info = TAG_DESCRIPTIONS[role];
              if (!info) return null;
              const Icon = info.icon;
              return (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${info.color}`} />
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${ROLE_COLORS[role]}`}>
                      {info.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* Auto-Assignment Logic */}
      <FadeIn direction="up" delay={0.3}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-lg text-foreground">Auto-Assignment Rules</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Roles automatically assigned based on committee positions. Admin and SuperAdmin can also manually assign/remove Moderator roles.
          </p>
          <div className="space-y-3">
            {AUTO_ASSIGNMENT_INFO.map((info, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className={`border rounded-lg p-4 ${info.color}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[info.role.toLowerCase()]}`}>
                    {info.role}
                  </span>
                  <span className="text-xs text-muted-foreground">← auto-assigned</span>
                </div>
                <p className="text-sm font-medium text-foreground">{info.positions}</p>
                <p className="text-xs text-muted-foreground mt-1">Committee: {info.committee}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p><strong>Archive transitions:</strong> When a committee is archived:</p>
            <p>• President & GS → Admin downgrades to Moderator + Advisor tag granted</p>
            <p>• OS & Treasurer → Moderator removed, falls back to Member</p>
          </div>
        </div>
      </FadeIn>

      {/* Permission Matrix — tier roles only */}
      <FadeIn direction="up" delay={0.35}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h2 className="font-semibold text-lg mb-4 text-foreground">Permission Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-2 font-medium text-foreground sticky left-0 bg-muted z-10 min-w-[140px]">Module : Action</th>
                  {displayRoles.map((role) => (
                    <th key={role} className="p-2 font-medium text-center capitalize whitespace-nowrap text-foreground">
                      {role.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => {
                  const modActions = actions.filter((a) => PERMISSIONS[`${mod}:${a}`]);
                  if (modActions.length === 0) return null;
                  return modActions.map((action, ai) => {
                    const key = `${mod}:${action}`;
                    const allowedRoles = PERMISSIONS[key] || [];
                    return (
                      <tr key={key} className={`border-b ${ai === 0 ? 'border-t-2 border-t-muted' : ''}`}>
                        <td className="p-2 sticky left-0 bg-card z-10">
                          <span className="font-medium text-foreground">{mod}</span>
                          <span className="text-muted-foreground"> : {action}</span>
                        </td>
                        {displayRoles.map((role) => (
                          <td key={role} className="p-2 text-center">
                            {allowedRoles.includes(role) ? (
                              <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>

      {/* Role Assignment History */}
      <RoleHistorySection />
    </div>
  );
}

function RoleHistorySection() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const filters: Record<string, string> = { page: String(page), limit: '15' };
  if (typeFilter) filters.assignmentType = typeFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'role-history', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/admin/role-history?${params}`);
      return data;
    },
  });

  const history = data?.data || [];
  const pagination = data?.pagination;

  return (
    <FadeIn direction="up" delay={0.4}>
      <div className="border rounded-lg p-4 sm:p-5 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg text-foreground">Role Assignment History</h2>
          </div>
          <div className="flex gap-2">
            {['', 'auto', 'manual'].map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                className={`px-2.5 py-1 text-xs rounded-md border capitalize ${
                  typeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                }`}
              >
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No role changes recorded</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-2.5 font-medium text-foreground">User</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Change</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Type</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Reason</th>
                  <th className="text-left p-2.5 font-medium text-foreground">By</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any, i: number) => (
                  <motion.tr
                    key={h._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b hover:bg-accent/30"
                  >
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        {h.user?.avatar ? (
                          <img src={h.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {h.user?.name?.[0] || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-foreground">{h.user?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground">{h.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[h.previousRole] || 'bg-muted text-muted-foreground'}`}>
                          {h.previousRole?.replace('_', ' ')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className={`px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[h.role] || 'bg-muted text-muted-foreground'}`}>
                          {h.role?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        h.assignmentType === 'auto'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {h.assignmentType}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground max-w-[150px] truncate" title={h.reason}>
                      {h.reason?.replace(/_/g, ' ')}
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground">{h.assignedBy?.name || '—'}</td>
                    <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(h.createdAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
            <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
