import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useTabParam } from '@/hooks/useTabParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Save, Loader2, Vote, Users, Shield, Crown, GraduationCap, Tag, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import {
  UserRole,
  CommitteePosition,
  TIER_HIERARCHY,
  TAG_ROLES,
  ADMIN_AUTO_POSITIONS,
  MODERATOR_AUTO_POSITIONS,
  SUPER_ADMIN_EMAILS,
} from '@rdswa/shared';
import {
  ACADEMIC_DOC_TYPES,
  IDENTITY_DOC_TYPES,
  DEFAULT_MEMBERSHIP_CRITERIA,
  type MembershipCriteria,
} from '@/lib/membershipDocs';

type Tab = 'voting' | 'membership' | 'autoRole';
const TABS: readonly Tab[] = ['voting', 'membership', 'autoRole'];

export default function AdminSystemConfigPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
  const [tab, setTab] = useTabParam<Tab>(TABS, 'voting');

  const tabs: { key: Tab; label: string; icon: any; superOnly?: boolean }[] = [
    { key: 'voting', label: 'Voting Rules', icon: Vote },
    { key: 'membership', label: 'Membership Criteria', icon: Users },
    { key: 'autoRole', label: 'Auto-Role Rules', icon: Shield, superOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || isSuperAdmin);

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">System Configuration</h1>

        <div className="flex flex-wrap gap-2 mb-6 border-b">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
                  tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'voting' && <VotingRulesConfig />}
        {tab === 'membership' && <MembershipCriteriaConfig />}
        {tab === 'autoRole' && isSuperAdmin && <AutoRoleConfig />}
      </div>
    </FadeIn>
  );
}

function VotingRulesConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'voting-rules'],
    queryFn: async () => {
      const { data } = await api.get('/settings/voting-rules');
      return data.data;
    },
  });

  const [form, setForm] = useState({
    minOptions: 2,
    maxOptions: 10,
    minVoteDurationHours: 1,
    maxVoteDurationDays: 30,
    allowAnonymousResults: false,
    requireMinVoterPercent: 0,
    defaultEligibility: 'all_members',
  });

  useEffect(() => {
    if (data) setForm({ ...form, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/voting-rules', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Voting rules updated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="border rounded-lg p-5 bg-card space-y-4 ">
        <div className="flex items-center gap-2 mb-2">
          <Vote className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Voting Rules Configuration</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Options per Vote</label>
            <input type="number" value={form.minOptions} onChange={(e) => setForm({ ...form, minOptions: parseInt(e.target.value) || 2 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={2} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Options per Vote</label>
            <input type="number" value={form.maxOptions} onChange={(e) => setForm({ ...form, maxOptions: parseInt(e.target.value) || 10 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={2} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Vote Duration (hours)</label>
            <input type="number" value={form.minVoteDurationHours} onChange={(e) => setForm({ ...form, minVoteDurationHours: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={1} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Vote Duration (days)</label>
            <input type="number" value={form.maxVoteDurationDays} onChange={(e) => setForm({ ...form, maxVoteDurationDays: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={1} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Voter Turnout (%)</label>
            <input type="number" value={form.requireMinVoterPercent} onChange={(e) => setForm({ ...form, requireMinVoterPercent: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={0} max={100} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Default Eligibility</label>
            <select value={form.defaultEligibility} onChange={(e) => setForm({ ...form, defaultEligibility: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm">
              <option value="all_members">All Members</option>
              <option value="batch_specific">Batch Specific</option>
              <option value="role_specific">Role Specific</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.allowAnonymousResults} onChange={(e) => setForm({ ...form, allowAnonymousResults: e.target.checked })}
            className="rounded" />
          Allow anonymous result viewing (before official publish)
        </label>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Voting Rules
        </motion.button>
      </div>
    </FadeIn>
  );
}

function MembershipCriteriaConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'membership-criteria'],
    queryFn: async () => {
      const { data } = await api.get('/settings/membership-criteria');
      return data.data;
    },
  });

  const [form, setForm] = useState<MembershipCriteria>(DEFAULT_MEMBERSHIP_CRITERIA);

  useEffect(() => {
    if (!data) return;
    // Merge loaded settings on top of defaults so older DB rows that don't
    // yet have the new doc-group fields still render with sensible values.
    setForm({
      ...DEFAULT_MEMBERSHIP_CRITERIA,
      ...data,
      academicDocs: { ...DEFAULT_MEMBERSHIP_CRITERIA.academicDocs, ...(data.academicDocs || {}) },
      identityDocs: { ...DEFAULT_MEMBERSHIP_CRITERIA.identityDocs, ...(data.identityDocs || {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/membership-criteria', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Membership criteria updated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const toggleAccepted = (group: 'academicDocs' | 'identityDocs', key: string) => {
    const current = form[group].accepted;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setForm({ ...form, [group]: { ...form[group], accepted: next } });
  };

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="border rounded-lg p-5 bg-card space-y-5 ">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Membership Criteria</h3>
        </div>

        {/* Academic Documents group */}
        <div className="space-y-2 p-3 rounded-md border bg-background/50">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.academicDocs.enabled}
              onChange={(e) => setForm({ ...form, academicDocs: { ...form.academicDocs, enabled: e.target.checked } })}
              className="rounded"
            />
            Require Academic Document (one of selected types)
          </label>
          <p className="text-xs text-muted-foreground">
            Applicant must upload one document of any selected type below.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {ACADEMIC_DOC_TYPES.map((d) => {
              const active = form.academicDocs.accepted.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  disabled={!form.academicDocs.enabled}
                  onClick={() => toggleAccepted('academicDocs', d.key)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                    active ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Identity Documents group */}
        <div className="space-y-2 p-3 rounded-md border bg-background/50">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.identityDocs.enabled}
              onChange={(e) => setForm({ ...form, identityDocs: { ...form.identityDocs, enabled: e.target.checked } })}
              className="rounded"
            />
            Require Identity Document (one of selected types)
          </label>
          <p className="text-xs text-muted-foreground">
            Applicant must upload one document of any selected type below.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {IDENTITY_DOC_TYPES.map((d) => {
              const active = form.identityDocs.accepted.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  disabled={!form.identityDocs.enabled}
                  onClick={() => toggleAccepted('identityDocs', d.key)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                    active ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireEmailVerification} onChange={(e) => setForm({ ...form, requireEmailVerification: e.target.checked })} className="rounded" />
            Require email verification before membership application
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requirePhoneVerification} onChange={(e) => setForm({ ...form, requirePhoneVerification: e.target.checked })} className="rounded" />
            Require phone verification before membership application
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Allowed Divisions (comma separated)</label>
            <input value={form.allowedDivisions.join(', ')}
              onChange={(e) => setForm({ ...form, allowedDivisions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Minimum Batch</label>
            <input type="number" value={form.minBatch} onChange={(e) => setForm({ ...form, minBatch: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={1} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              Max Pending Review Days
              <span title="SLA warning threshold. Pending forms older than this show an 'overdue' badge in the review queue. No automated action is taken." className="text-muted-foreground/70 cursor-help">ⓘ</span>
            </label>
            <input type="number" value={form.maxPendingDays} onChange={(e) => setForm({ ...form, maxPendingDays: parseInt(e.target.value) || 7 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={1} />
            <p className="text-[11px] text-muted-foreground mt-1">SLA target — overdue badge only, no auto-action.</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Auto-Reject After Days (0 = disabled)</label>
            <input type="number" value={form.autoRejectAfterDays} onChange={(e) => setForm({ ...form, autoRejectAfterDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={0} />
          </div>
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Membership Criteria
        </motion.button>
      </div>
    </FadeIn>
  );
}

type AutoRoleConfigShape = {
  adminPositions: string[];
  moderatorPositions: string[];
  advisorOnArchivePositions: string[];
};

const ALL_COMMITTEE_POSITIONS = Object.values(CommitteePosition);

const FALLBACK_AUTO_ROLE_CONFIG: AutoRoleConfigShape = {
  adminPositions: [...ADMIN_AUTO_POSITIONS],
  moderatorPositions: [...MODERATOR_AUTO_POSITIONS],
  advisorOnArchivePositions: [...ADMIN_AUTO_POSITIONS],
};

/**
 * Visualizes the live auto-role configuration. The same rules drive both
 * automatic transitions (committee changes / startup sync) and manual
 * role-change validation, so any future tweak by SuperAdmin propagates
 * everywhere consistently. Edit panel below is SuperAdmin-only.
 */
function AutoRoleConfig() {
  const formatPos = (p: string) => p.replace(/_/g, ' ');

  const { data: liveConfig } = useQuery<AutoRoleConfigShape>({
    queryKey: ['settings', 'auto-role-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/auto-role-config');
      const cfg = data.data || {};
      return {
        adminPositions: Array.isArray(cfg.adminPositions) ? cfg.adminPositions : FALLBACK_AUTO_ROLE_CONFIG.adminPositions,
        moderatorPositions: Array.isArray(cfg.moderatorPositions) ? cfg.moderatorPositions : FALLBACK_AUTO_ROLE_CONFIG.moderatorPositions,
        advisorOnArchivePositions: Array.isArray(cfg.advisorOnArchivePositions) ? cfg.advisorOnArchivePositions : FALLBACK_AUTO_ROLE_CONFIG.advisorOnArchivePositions,
      };
    },
  });

  const cfg = liveConfig ?? FALLBACK_AUTO_ROLE_CONFIG;

  const tierRoleDescriptions: Record<string, string> = {
    [UserRole.GUEST]: 'Unauthenticated visitor — read-only public access',
    [UserRole.USER]: 'Registered account, membership not approved yet',
    [UserRole.MEMBER]: 'Approved member — full member-only features',
    [UserRole.MODERATOR]: 'Content moderator — review forms, manage events/notices',
    [UserRole.ADMIN]: 'Administrator — full management except SuperAdmin-restricted areas',
    [UserRole.SUPER_ADMIN]: 'Highest tier — hardcoded by email, full access',
  };

  const tagDescriptions: Record<string, { label: string; desc: string }> = {
    [UserRole.ALUMNI]: { label: 'Alumni', desc: 'Approved member with current job/business or admin grant' },
    [UserRole.ADVISOR]: { label: 'Advisor', desc: 'Auto-granted to ex-President / ex-General Secretary on archive, or admin grant' },
    [UserRole.SENIOR_ADVISOR]: { label: 'Senior Advisor', desc: 'Manually granted by Admin+ (no membership gate — any user can hold this tag)' },
  };

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="space-y-5">
        <div className="border rounded-lg p-5 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Role Assignment Logic</h3>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              The position lists below drive both automatic role transitions (committee create / member add / archive / startup sync) and the role-change validation. Defaults match the original RDSWA constitution. Changes apply to future committee transitions only — they do not retroactively rewrite existing user roles.
            </p>
          </div>
        </div>

        {/* Tier roles */}
        <div className="border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Tier Roles (single privilege level)</h4>
          </div>
          <p className="text-xs text-muted-foreground">A user has exactly one tier role. Higher tier inherits all permissions below.</p>
          <ol className="space-y-1.5">
            {TIER_HIERARCHY.map((role, i) => (
              <li key={role} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary capitalize whitespace-nowrap">
                  {formatPos(role)}
                </span>
                <span className="text-muted-foreground text-xs">{tierRoleDescriptions[role]}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Tag roles */}
        <div className="border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Tag Roles (orthogonal flags)</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Independent of tier role. A user may carry any combination of these tags alongside any tier role. Granted via dedicated endpoints, not via the role-change dropdown.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TAG_ROLES.map((r) => (
              <div key={r} className="rounded-md border p-3 bg-background/50">
                <div className="flex items-center gap-2 mb-1">
                  {r === UserRole.ALUMNI ? <GraduationCap className="h-3.5 w-3.5 text-primary" /> : <Tag className="h-3.5 w-3.5 text-primary" />}
                  <span className="font-medium text-sm">{tagDescriptions[r].label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{tagDescriptions[r].desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-assignments from current committee */}
        <div className="border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Auto-Role from Current Committee Position</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Triggered on committee create / member add / startup sync. Higher-tier wins — a SuperAdmin in a committee is never downgraded.
          </p>

          <div className="space-y-2">
            <PositionRow positions={cfg.adminPositions} target="admin" />
            <PositionRow positions={cfg.moderatorPositions} target="moderator" />
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs capitalize">
                {ALL_COMMITTEE_POSITIONS
                  .filter((p) => !cfg.adminPositions.includes(p) && !cfg.moderatorPositions.includes(p))
                  .map(formatPos)
                  .join(', ') || '—'}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground italic">no role change</span>
            </div>
          </div>
        </div>

        {/* Archive transitions */}
        <div className="border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Archive Transitions (committee marked historical)</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            When a committee transitions from current to archived, ex-officers transition based on their position.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <div className="flex flex-wrap gap-1.5 min-w-[6rem]">
                {cfg.adminPositions.length > 0 ? (
                  cfg.adminPositions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs capitalize">
                      ex-{formatPos(p)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">none configured</span>
                )}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">admin → moderator</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <div className="flex flex-wrap gap-1.5 min-w-[6rem]">
                {cfg.moderatorPositions.length > 0 ? (
                  cfg.moderatorPositions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs capitalize">
                      ex-{formatPos(p)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">none configured</span>
                )}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">moderator → base (member/user)</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <div className="flex flex-wrap gap-1.5 min-w-[6rem]">
                {cfg.advisorOnArchivePositions.length > 0 ? (
                  cfg.advisorOnArchivePositions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs capitalize">
                      ex-{formatPos(p)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">none configured</span>
                )}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">+ advisor tag</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Multi-committee safeguard: a user is only downgraded if they don't still hold a qualifying position in another current committee.
          </p>
        </div>

        {/* Manual change rules */}
        <div className="border rounded-lg p-5 bg-card space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Manual Change Rules</h4>
          </div>
          <ul className="text-xs space-y-1.5 text-muted-foreground list-disc list-inside">
            <li>Tier-role dropdown only exposes <span className="font-medium text-foreground">user / member / moderator / admin</span>. Tag roles are not selectable as tiers.</li>
            <li>Only <span className="font-medium text-foreground">SuperAdmin</span> can manually assign the <span className="font-mono">admin</span> role.</li>
            <li>SuperAdmin emails are hardcoded ({SUPER_ADMIN_EMAILS.length} accounts) and cannot be demoted.</li>
            <li>Tag roles (alumni / advisor / senior advisor) are granted via dedicated endpoints — see Admin → Roles & Tags.</li>
            <li>Promoting to <span className="font-medium text-foreground">member</span>+ auto-approves membership; demoting below member reverts it.</li>
          </ul>
        </div>

        <AutoRoleEditor liveConfig={cfg} />
      </div>
    </FadeIn>
  );
}

/** Small reusable row used by the read-only "current → role" mappings. */
function PositionRow({ positions, target }: { positions: string[]; target: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <div className="flex flex-wrap gap-1.5 min-w-[6rem]">
        {positions.length > 0 ? (
          positions.map((p) => (
            <span key={p} className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs capitalize">
              {p.replace(/_/g, ' ')}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground italic">none configured</span>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{target}</span>
    </div>
  );
}

/**
 * SuperAdmin-only edit panel for the auto-role rules. Saves to
 * `/settings/auto-role-config` (PATCH gated to SuperAdmin on the server).
 */
function AutoRoleEditor({ liveConfig }: { liveConfig: AutoRoleConfigShape }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [adminPositions, setAdminPositions] = useState<Set<string>>(new Set(liveConfig.adminPositions));
  const [moderatorPositions, setModeratorPositions] = useState<Set<string>>(new Set(liveConfig.moderatorPositions));
  const [advisorOnArchivePositions, setAdvisorOnArchivePositions] = useState<Set<string>>(new Set(liveConfig.advisorOnArchivePositions));

  // Sync local state when server data refreshes
  useEffect(() => {
    setAdminPositions(new Set(liveConfig.adminPositions));
    setModeratorPositions(new Set(liveConfig.moderatorPositions));
    setAdvisorOnArchivePositions(new Set(liveConfig.advisorOnArchivePositions));
  }, [liveConfig]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/auto-role-config', {
      adminPositions: [...adminPositions],
      moderatorPositions: [...moderatorPositions],
      advisorOnArchivePositions: [...advisorOnArchivePositions],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'auto-role-config'] });
      toast.success('Auto-role rules updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  // Toggle membership in a set, ensuring no overlap between admin and moderator.
  const togglePosition = (
    set: Set<string>,
    setFn: (s: Set<string>) => void,
    pos: string,
    exclusiveWith?: { set: Set<string>; setFn: (s: Set<string>) => void },
  ) => {
    const next = new Set(set);
    if (next.has(pos)) next.delete(pos);
    else next.add(pos);
    setFn(next);
    // If this position is now in our set and also in the exclusive partner, drop it from there
    if (next.has(pos) && exclusiveWith?.set.has(pos)) {
      const partnerNext = new Set(exclusiveWith.set);
      partnerNext.delete(pos);
      exclusiveWith.setFn(partnerNext);
    }
  };

  const renderChips = (
    activeSet: Set<string>,
    setFn: (s: Set<string>) => void,
    exclusiveWith?: { set: Set<string>; setFn: (s: Set<string>) => void },
    activeColor: string = 'bg-primary/10 border-primary/30 text-primary',
  ) => (
    <div className="flex flex-wrap gap-2">
      {ALL_COMMITTEE_POSITIONS.map((pos) => {
        const active = activeSet.has(pos);
        return (
          <button
            key={pos}
            type="button"
            onClick={() => togglePosition(activeSet, setFn, pos, exclusiveWith)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors capitalize ${
              active ? `${activeColor} font-medium` : 'hover:bg-accent'
            }`}
          >
            {pos.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );

  const dirty =
    setEqualsArray(adminPositions, liveConfig.adminPositions) === false ||
    setEqualsArray(moderatorPositions, liveConfig.moderatorPositions) === false ||
    setEqualsArray(advisorOnArchivePositions, liveConfig.advisorOnArchivePositions) === false;

  return (
    <div className="border-2 border-primary/30 rounded-lg p-5 bg-primary/5 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-foreground text-sm">Edit Rules</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Changes apply to all future committee transitions and the next server-startup role sync. They do not retroactively change existing user roles.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
            Auto-assign Admin to these positions (in current committee)
          </label>
          {renderChips(adminPositions, setAdminPositions, { set: moderatorPositions, setFn: setModeratorPositions })}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
            Auto-assign Moderator to these positions (in current committee)
          </label>
          {renderChips(moderatorPositions, setModeratorPositions, { set: adminPositions, setFn: setAdminPositions })}
          <p className="text-[11px] text-muted-foreground mt-1">A position cannot be both Admin and Moderator — selecting it in one auto-removes it from the other.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
            Grant Advisor tag when their committee archives
          </label>
          {renderChips(advisorOnArchivePositions, setAdvisorOnArchivePositions, undefined, 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400')}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !dirty}
        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {dirty ? 'Save Auto-Role Rules' : 'No changes'}
      </motion.button>
    </div>
  );
}

function setEqualsArray(s: Set<string>, arr: string[]): boolean {
  if (s.size !== arr.length) return false;
  for (const v of arr) if (!s.has(v)) return false;
  return true;
}
