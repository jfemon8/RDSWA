import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { X, Search, Send, Loader2, Users, User as UserIcon, Hash, Globe, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Props {
  messageId: string;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, typeof Users> = {
  central: Globe,
  department: Building2,
  custom: Hash,
};

/**
 * Forward a message to one or more groups and/or DM partners.
 * Lets the user multi-select destinations and dispatches in a single request.
 */
export default function ForwardModal({ messageId, onClose }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'groups' | 'people'>('groups');
  const [search, setSearch] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const { data } = await api.get('/communication/groups');
      return data.data;
    },
  });

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['forward-member-search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(search)}&limit=20`);
      return data.data;
    },
    enabled: tab === 'people' && search.length >= 2,
  });

  const filteredGroups = (groups || []).filter((g: any) =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  );

  const forwardMutation = useMutation({
    mutationFn: () => api.post(`/communication/messages/${messageId}/forward`, {
      groupIds: Array.from(selectedGroups),
      userIds: Array.from(selectedUsers),
    }),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Forwarded');
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to forward');
    },
  });

  const totalSelected = selectedGroups.size + selectedUsers.size;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="bg-card border rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Forward Message</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg text-xs mb-3">
            <button
              type="button"
              onClick={() => setTab('groups')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md transition-colors ${
                tab === 'groups' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Groups
            </button>
            <button
              type="button"
              onClick={() => setTab('people')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md transition-colors ${
                tab === 'people' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <UserIcon className="h-3.5 w-3.5" /> People
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'groups' ? 'Search groups…' : 'Search members…'}
              className="w-full pl-9 pr-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {tab === 'groups' && (
            loadingGroups ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filteredGroups.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No groups</p>
            ) : (
              <ul className="space-y-1">
                {filteredGroups.map((g: any) => {
                  const Icon = TYPE_ICONS[g.type] || Hash;
                  const checked = selectedGroups.has(g._id);
                  return (
                    <li key={g._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(g._id)) next.delete(g._id);
                          else next.add(g._id);
                          return next;
                        })}
                        className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left ${checked ? 'bg-primary/10' : ''}`}
                      >
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {g.avatar ? (
                            <img src={g.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Icon className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{g.members?.length || 0} members</p>
                        </div>
                        <span
                          className={`h-4 w-4 rounded-full border-2 shrink-0 ${
                            checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {tab === 'people' && (
            search.length < 2 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Type at least 2 characters to search.</p>
            ) : loadingMembers ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (members || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No members found</p>
            ) : (
              <ul className="space-y-1">
                {members.map((u: any) => {
                  const checked = selectedUsers.has(u._id);
                  return (
                    <li key={u._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUsers((prev) => {
                          const next = new Set(prev);
                          if (next.has(u._id)) next.delete(u._id);
                          else next.add(u._id);
                          return next;
                        })}
                        className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left ${checked ? 'bg-primary/10' : ''}`}
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          {u.department && <p className="text-[11px] text-muted-foreground truncate">{u.department}</p>}
                        </div>
                        <span
                          className={`h-4 w-4 rounded-full border-2 shrink-0 ${
                            checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {totalSelected} selected
          </span>
          <button
            type="button"
            onClick={() => forwardMutation.mutate()}
            disabled={totalSelected === 0 || forwardMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
          >
            {forwardMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Forward
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
