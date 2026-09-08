import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePresence, useDMSocket, useGroupActivitySocket } from '@/hooks/useSocket';
import {
  Search, MessagesSquare, MailOpen, Globe, Building2, Hash,
  Plus, ChevronRight, Users, UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import PresenceBadge from '@/components/chat/PresenceBadge';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import CreateGroupForm from '@/components/chat/CreateGroupForm';
import { formatDateCustom } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';

/** Unified chat hub listing DMs and groups, holding no chat state and only routing to the dedicated pages. */

type Tab = 'all' | 'chats' | 'groups' | 'unread';

interface UnifiedItem {
  kind: 'dm' | 'group';
  id: string;
  name: string;
  avatar?: string;
  subtitle: string;
  timestamp?: string;
  unreadCount: number;
  groupType?: string;
  to: string;
  raw: any;
}

const GROUP_TYPE_ICONS: Record<string, typeof Globe> = {
  central: Globe,
  department: Building2,
  custom: Hash,
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDateCustom(dateStr, { month: 'short', day: 'numeric' });
}

/** A group row names who wrote last, since several people can be talking in one thread. */
function groupMessagePreview(msg: any, viewerId?: string): string {
  const body = lastMessagePreview(msg);
  const sender = msg?.sender;
  if (!sender?.name) return body;
  return `${sender._id === viewerId ? 'You' : sender.name.split(' ')[0]}: ${body}`;
}

function lastMessagePreview(msg: any): string {
  if (!msg) return 'No messages yet';
  if (msg.content) return msg.content;
  if (msg.attachments?.length) {
    const kind = msg.attachments[0]?.kind || 'file';
    return `📎 ${kind.charAt(0).toUpperCase() + kind.slice(1)}`;
  }
  return '';
}

const TAB_STORAGE_KEY = 'chat-hub-tab';
const VALID_TABS: Tab[] = ['all', 'chats', 'groups', 'unread'];

function readInitialTab(urlTab: string | null): Tab {
  if (urlTab && (VALID_TABS as string[]).includes(urlTab)) return urlTab as Tab;
  try {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (saved && (VALID_TABS as string[]).includes(saved)) return saved as Tab;
  } catch { /* sessionStorage unavailable — private mode, etc. */ }
  return 'all';
}

export default function ChatHubPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const isMod = !!user?.role && hasMinRole(user.role, UserRole.MODERATOR);
  const [searchParams, setSearchParams] = useSearchParams();
  // Preserve the selected tab across conversation entry/exit. Priority:
  //   1. ?tab= in URL (shareable / deep-linkable)
  //   2. sessionStorage (survives internal navigation even without URL state)
  //   3. Default to 'all'
  const [tab, setTab] = useState<Tab>(() => readInitialTab(searchParams.get('tab')));
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // Persist the active tab so returning from a conversation restores it.
  useEffect(() => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* ignore */ }
    const current = searchParams.get('tab');
    if (current !== tab) {
      const next = new URLSearchParams(searchParams);
      if (tab === 'all') next.delete('tab');
      else next.set('tab', tab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Fetch both data sources in parallel; each has independent loading state.
  const { data: dms, isLoading: loadingDms } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: async () => {
      const { data } = await api.get('/communication/dm');
      return data.data as any[];
    },
  });

  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: async () => {
      const { data } = await api.get('/communication/groups');
      return data.data as any[];
    },
  });

  // Discoverable groups, loaded only while the Groups tab is open since it is the only place they show.
  const { data: browseGroups } = useQuery({
    queryKey: ['browse-groups'],
    queryFn: async () => {
      const { data } = await api.get('/communication/groups/browse');
      return data.data as any[];
    },
    enabled: tab === 'groups',
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/communication/groups/${groupId}/join`),
    onSuccess: () => {
      toast.success('Join request submitted!');
      queryClient.invalidateQueries({ queryKey: ['browse-groups'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send join request'),
  });

  // Member search for the "New chat" popover.
  const { data: memberResults } = useQuery({
    queryKey: ['hub-member-search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(search)}&limit=8`);
      return data.data as any[];
    },
    enabled: showNewChat && search.length >= 2,
  });

  // Presence for the online dots on DM tiles.
  const partnerIds = useMemo(
    () => (dms || []).map((c) => c.user?._id).filter(Boolean),
    [dms]
  );
  const { online } = usePresence(partnerIds);

  // Keep the ordering live: any DM or group message refreshes the two lists this page sorts.
  useDMSocket(undefined);
  useGroupActivitySocket();

  // Normalise DMs and groups into one typed list sorted by most recent activity, keeping the render loop simple.
  const unified: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];

    for (const conv of dms || []) {
      if (!conv.user?._id) continue;
      items.push({
        kind: 'dm',
        id: conv.user._id,
        name: conv.user.name || 'Unknown',
        avatar: conv.user.avatar,
        subtitle: lastMessagePreview(conv.lastMessage),
        timestamp: conv.lastMessage?.createdAt,
        unreadCount: conv.unreadCount || 0,
        to: `/dashboard/messages?with=${conv.user._id}`,
        raw: conv,
      });
    }

    for (const g of groups || []) {
      items.push({
        kind: 'group',
        id: g._id,
        name: g.name,
        avatar: g.avatar,
        subtitle: g.lastMessage
          ? groupMessagePreview(g.lastMessage, user?._id)
          : `${g.members?.length || 0} members`,
        timestamp: g.lastActivityAt || g.updatedAt,
        // Server reports per-group unread count via aggregation on the
        // /communication/groups endpoint — see its handler for the query.
        unreadCount: g.unreadCount || 0,
        groupType: g.type,
        to: `/dashboard/groups/${g._id}`,
        raw: g,
      });
    }

    // Sort by most recent activity — missing timestamps sink to the bottom.
    items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    return items;
  }, [dms, groups]);

  const filtered = useMemo(() => {
    let list = unified;
    if (tab === 'chats') list = list.filter((i) => i.kind === 'dm');
    if (tab === 'groups') list = list.filter((i) => i.kind === 'group');
    if (tab === 'unread') list = list.filter((i) => (i.unreadCount || 0) > 0);
    if (search.trim() && !showNewChat) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q));
    }
    return list;
  }, [unified, tab, search, showNewChat]);

  const isLoading = loadingDms || loadingGroups;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 gap-2">
        <BlurText
          text="Chat"
          className="text-2xl sm:text-3xl font-bold"
          delay={50}
          animateBy="words"
          direction="bottom"
        />
        <div className="flex items-center gap-2">
          {isMod && (
            <button
              onClick={() => { setShowCreateGroup((v) => !v); setShowNewChat(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent"
            >
              <Users className="h-4 w-4" /> New Group
            </button>
          )}
          <button
            onClick={() => { setShowNewChat((v) => !v); setShowCreateGroup(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Chat
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCreateGroup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CreateGroupForm
              onCreated={() => {
                setShowCreateGroup(false);
                queryClient.invalidateQueries({ queryKey: ['my-groups'] });
              }}
              onCancel={() => setShowCreateGroup(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* New-chat inline popover */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Start a conversation</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  placeholder="Search members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {search.length >= 2 && (memberResults || []).length > 0 && (
                <div className="mt-2 space-y-0.5 max-h-52 overflow-y-auto">
                  {(memberResults || []).map((u: any) => (
                    <Link
                      key={u._id}
                      to={`/dashboard/messages?with=${u._id}`}
                      onClick={() => { setShowNewChat(false); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                          {u.name?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        {u.department && (
                          <p className="text-[11px] text-muted-foreground truncate">{u.department}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search (filters the unified list, separate from new-chat popover) */}
      {!showNewChat && (
        <FadeIn delay={0.08} direction="up">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </FadeIn>
      )}

      {/* Tabs — WhatsApp style pill tabs */}
      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1 w-fit">
        {(['all', 'chats', 'groups', 'unread'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-1.5 rounded-md text-sm capitalize transition-colors ${
              tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === t && (
              <motion.div
                layoutId="chat-hub-tab-indicator"
                className="absolute inset-0 bg-background rounded-md shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {t === 'unread' && <MailOpen className="h-3 w-3" />}
              {t}
            </span>
          </button>
        ))}
      </div>

      {/* Unified list */}
      {isLoading ? (
        <Spinner size="md" />
      ) : filtered.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-16 text-sm text-muted-foreground">
            <MessagesSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>
              {tab === 'chats'
                ? 'No direct messages yet.'
                : tab === 'groups'
                  ? 'You are not in any groups yet.'
                  : tab === 'unread'
                    ? 'Nothing unread — you are all caught up.'
                    : 'No conversations yet.'}
            </p>
            <p className="text-xs mt-1">
              Tap "New Chat" to start a conversation or{' '}
              <button type="button" onClick={() => setTab('groups')} className="text-primary hover:underline">browse groups</button>.
            </p>
          </div>
        </FadeIn>
      ) : (
        // `layout` animates the reorder, and the entry animation is tied to mount rather than to
        // scrolling into view — a scroll-triggered one leaves rows that merely moved stuck at opacity 0.
        <motion.div layout className="space-y-1">
          {filtered.map((item) => (
            <motion.div
              key={`${item.kind}-${item.id}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ConversationTile item={item} online={item.kind === 'dm' ? online.has(item.id) : false} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === 'groups' && (browseGroups?.length || 0) > 0 && (
        <FadeIn direction="up" delay={0.1}>
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Groups you can join</h2>
            <div className="space-y-1">
              {(browseGroups || []).map((g: any) => (
                <div key={g._id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.members?.length || 0} members</p>
                  </div>
                  <button
                    onClick={() => joinMutation.mutate(g._id)}
                    disabled={joinMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs hover:bg-accent shrink-0 disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}


function ConversationTile({ item, online }: { item: UnifiedItem; online: boolean }) {
  const TypeIcon = item.kind === 'group' ? (GROUP_TYPE_ICONS[item.groupType || 'custom'] || Hash) : null;

  return (
    <Link
      to={item.to}
      state={item.kind === 'dm' ? { partner: { _id: item.id, name: item.name, avatar: item.avatar } } : undefined}
      className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {item.avatar ? (
          <img src={item.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : item.kind === 'group' && TypeIcon ? (
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
            <TypeIcon className="h-5 w-5 text-primary" />
          </div>
        ) : (
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {item.name[0]?.toUpperCase()}
          </div>
        )}
        {item.kind === 'dm' && online && (
          <span className="absolute bottom-0 right-0">
            <PresenceBadge online size={10} />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-sm font-medium truncate min-w-0">{item.name}</span>
            {item.kind === 'group' && item.groupType && (
              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground capitalize font-normal shrink-0">
                {item.groupType}
              </span>
            )}
          </div>
          {item.timestamp && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatTimeAgo(item.timestamp)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
      </div>

      {/* Unread badge */}
      {item.unreadCount > 0 ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shrink-0"
        >
          {item.unreadCount > 99 ? '99+' : item.unreadCount}
        </motion.span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </Link>
  );
}

