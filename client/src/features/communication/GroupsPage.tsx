import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import {
  Users, Plus, Loader2, Search, ChevronRight, Globe, Building2,
  UserPlus, Clock, Hash,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { useToast } from '@/components/ui/Toast';

const GROUP_TYPE_ICONS: Record<string, typeof Globe> = {
  central: Globe,
  department: Building2,
  custom: Hash,
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  central: 'Central',
  department: 'Department',
  custom: 'Custom',
};

export default function GroupsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'browse'>('my');

  const isMod = user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);

  const { data: myGroups, isLoading: loadingMy } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const { data } = await api.get('/communication/groups');
      return data.data;
    },
  });

  const { data: browseGroups, isLoading: loadingBrowse } = useQuery({
    queryKey: ['browse-groups'],
    queryFn: async () => {
      const { data } = await api.get('/communication/groups/browse');
      return data.data;
    },
    enabled: tab === 'browse',
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/communication/groups/${groupId}/join`),
    onSuccess: () => {
      toast.success('Join request submitted!');
      queryClient.invalidateQueries({ queryKey: ['browse-groups'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send join request');
    },
  });

  const groups = tab === 'my' ? (myGroups || []) : (browseGroups || []);
  const isLoading = tab === 'my' ? loadingMy : loadingBrowse;

  const filteredGroups = search
    ? groups.filter((g: any) => g.name?.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-6">
        <BlurText text="Groups" className="text-2xl sm:text-3xl font-bold" delay={50} />
        {isMod && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <Plus className="h-4 w-4" /> New Group
          </button>
        )}
      </div>

      {/* Create Group Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CreateGroupForm
              onCreated={() => {
                setShowCreate(false);
                queryClient.invalidateQueries({ queryKey: ['my-groups'] });
              }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <FadeIn delay={0.05} direction="up" distance={15}>
        <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 w-fit">
          {(['my', 'browse'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === t && (
                <motion.div
                  layoutId="group-tab-indicator"
                  className="absolute inset-0 bg-background rounded-md shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t === 'my' ? 'My Groups' : 'Browse'}</span>
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Search */}
      <FadeIn delay={0.08} direction="up" distance={15}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </FadeIn>

      {/* Group List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {tab === 'my' ? 'You are not in any groups yet.' : 'No groups available to join.'}
            </p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group: any, i: number) => {
            const TypeIcon = GROUP_TYPE_ICONS[group.type] || Hash;
            return (
              <FadeIn key={group._id} delay={i * 0.03} direction="up" distance={15}>
                {tab === 'my' ? (
                  <Link to={`/dashboard/groups/${group._id}`}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="p-4 rounded-lg border bg-card hover:bg-accent flex items-center gap-4 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {group.avatar ? (
                          <img src={group.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <TypeIcon className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-medium text-sm truncate">{group.name}</h3>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                            {GROUP_TYPE_LABELS[group.type] || group.type}
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{group.members?.length || 0} members</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </motion.div>
                  </Link>
                ) : (
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="p-4 rounded-lg border bg-card flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <TypeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-medium text-sm truncate">{group.name}</h3>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                          {GROUP_TYPE_LABELS[group.type] || group.type}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{group.memberCount || 0} members</span>
                      </div>
                    </div>
                    {group.hasPendingRequest ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground px-3 py-1.5 bg-muted rounded-md">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => joinMutation.mutate(group._id)}
                        disabled={joinMutation.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                      >
                        <UserPlus className="h-3 w-3" /> Join
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateGroupForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const createMutation = useMutation({
    mutationFn: () => api.post('/communication/groups', { name, description, type: 'custom' }),
    onSuccess: () => {
      toast.success('Group created!');
      onCreated();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create group');
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Group name is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    createMutation.mutate();
  };

  return (
    <div className="bg-card border rounded-lg p-5 mb-4">
      <h3 className="font-semibold mb-3">Create New Group</h3>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Group name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.name} />
        </div>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
