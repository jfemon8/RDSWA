import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useTabParam } from '@/hooks/useTabParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Save, Loader2, Vote, Users, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';

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

  const [form, setForm] = useState({
    requireStudentId: true,
    requireNidUpload: true,
    requireUniversityIdUpload: true,
    allowedDivisions: ['Rangpur'],
    minBatch: 1,
    maxPendingDays: 7,
    autoRejectAfterDays: 30,
    requireEmailVerification: false,
    requirePhoneVerification: false,
  });

  useEffect(() => {
    if (data) setForm({ ...form, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/membership-criteria', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Membership criteria updated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="border rounded-lg p-5 bg-card space-y-4 ">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Membership Criteria</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireStudentId} onChange={(e) => setForm({ ...form, requireStudentId: e.target.checked })} className="rounded" />
            Require Student ID during application
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireNidUpload} onChange={(e) => setForm({ ...form, requireNidUpload: e.target.checked })} className="rounded" />
            Require NID/Passport/Birth Certificate upload
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireUniversityIdUpload} onChange={(e) => setForm({ ...form, requireUniversityIdUpload: e.target.checked })} className="rounded" />
            Require University ID Card upload
          </label>
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
            <label className="text-xs text-muted-foreground mb-1 block">Max Pending Review Days</label>
            <input type="number" value={form.maxPendingDays} onChange={(e) => setForm({ ...form, maxPendingDays: parseInt(e.target.value) || 7 })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" min={1} />
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

function AutoRoleConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const allPositions = [
    'president', 'vice_president', 'general_secretary', 'joint_secretary',
    'organizing_secretary', 'treasurer', 'member',
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'auto-role-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/auto-role-config');
      return data.data;
    },
  });

  const [moderatorPositions, setModeratorPositions] = useState<Set<string>>(
    new Set(['president', 'general_secretary', 'organizing_secretary', 'treasurer'])
  );
  const [retainPositions, setRetainPositions] = useState<Set<string>>(
    new Set(['president', 'general_secretary'])
  );

  useEffect(() => {
    if (data) {
      if (data.moderatorPositions) setModeratorPositions(new Set(data.moderatorPositions));
      if (data.retainPositions) setRetainPositions(new Set(data.retainPositions));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/auto-role-config', {
      moderatorPositions: [...moderatorPositions],
      retainPositions: [...retainPositions],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Auto-role config updated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const togglePosition = (set: Set<string>, setFn: (s: Set<string>) => void, pos: string) => {
    const next = new Set(set);
    if (next.has(pos)) next.delete(pos);
    else next.add(pos);
    setFn(next);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="border rounded-lg p-5 bg-card space-y-6 ">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Auto-Role Assignment Rules</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Configure which committee positions automatically receive the Moderator role when assigned.
        </p>

        {/* Moderator auto-assign positions */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
            Auto-assign Moderator to these positions
          </label>
          <div className="flex flex-wrap gap-2">
            {allPositions.map((pos) => (
              <label
                key={pos}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border cursor-pointer transition-colors capitalize ${
                  moderatorPositions.has(pos) ? 'bg-primary/10 border-primary/30 text-primary font-medium' : 'hover:bg-accent'
                }`}
              >
                <input type="checkbox" checked={moderatorPositions.has(pos)}
                  onChange={() => togglePosition(moderatorPositions, setModeratorPositions, pos)}
                  className="rounded" />
                {pos.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </div>

        {/* Retain moderator after archive */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
            Retain Moderator after committee archives (ex-holders keep role)
          </label>
          <div className="flex flex-wrap gap-2">
            {allPositions.map((pos) => (
              <label
                key={pos}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border cursor-pointer transition-colors capitalize ${
                  retainPositions.has(pos) ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium' : 'hover:bg-accent'
                }`}
              >
                <input type="checkbox" checked={retainPositions.has(pos)}
                  onChange={() => togglePosition(retainPositions, setRetainPositions, pos)}
                  className="rounded" />
                {pos.replace(/_/g, ' ')}
              </label>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-md bg-muted text-xs text-muted-foreground">
          <strong>Current rules:</strong> When a new committee is created, members in positions [{[...moderatorPositions].join(', ')}] will automatically get the Moderator role.
          When a committee is archived, ex-holders of [{[...retainPositions].join(', ')}] will retain their Moderator role permanently.
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Auto-Role Rules
        </motion.button>
      </div>
    </FadeIn>
  );
}
