import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePresence } from '@/hooks/useSocket';
import {
  Search, MessagesSquare, Star, Globe, Building2, Hash,
  Plus, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import PresenceBadge from '@/components/chat/PresenceBadge';
import { formatDateCustom } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';

/**
 * Unified "chat hub" — single landing page listing DMs, groups, and starred
 * in one place. Selecting an item navigates to the existing dedicated page
 * (MessagesPage / GroupChatPage / StarredMessagesPage). No chat state is
 * managed here — this is purely a router + list view.
 */

type Tab = 'all' | 'chats' | 'groups' | 'starred';

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
const VALID_TABS: Tab[] = ['all', 'chats', 'groups', 'starred'];

function readInitialTab(urlTab: string | null): Tab {
  if (urlTab && (VALID_TABS as string[]).includes(urlTab)) return urlTab as Tab;
  try {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (saved && (VALID_TABS as string[]).includes(saved)) return saved as Tab;
  } catch { /* sessionStorage unavailable — private mode, etc. */ }
  return 'all';
}

export default function ChatHubPage() {
  const navigate = useNavigate();
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

  // Normalize DMs and groups into a single typed list so the render loop is
  // simple. Sorted by most recent activity across both kinds.
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
        subtitle: g.description || `${g.members?.length || 0} members`,
        timestamp: g.updatedAt,
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
          <button
            onClick={() => setShowNewChat((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Chat
          </button>
        </div>
      </div>

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
        {(['all', 'chats', 'groups', 'starred'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === 'starred') {
                navigate('/dashboard/starred');
                return;
              }
              setTab(t);
            }}
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
              {t === 'starred' && <Star className="h-3 w-3" />}
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
                  : 'No conversations yet.'}
            </p>
            <p className="text-xs mt-1">
              Tap "New Chat" to start a conversation or{' '}
              <Link to="/dashboard/groups" className="text-primary hover:underline">browse groups</Link>.
            </p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-1">
          {filtered.map((item, i) => (
            <FadeIn key={`${item.kind}-${item.id}`} delay={i * 0.03} direction="up" distance={10}>
              <ConversationTile item={item} online={item.kind === 'dm' ? online.has(item.id) : false} />
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationTile({ item, online }: { item: UnifiedItem; online: boolean }) {
  const TypeIcon = item.kind === 'group' ? (GROUP_TYPE_ICONS[item.groupType || 'custom'] || Hash) : null;

  return (
    <Link
      to={item.to}
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

