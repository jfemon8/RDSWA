import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(socketUrl, {
      path: '/socket.io',
      // Dynamic auth: socket.io invokes this callback on every (re)connect,
      // so a refreshed access token or a post-login token is picked up
      // automatically. With a static `auth: { token }` the server would keep
      // seeing a stale/expired token on reconnects — causing presence to
      // silently drop the user from `onlineUsers` and making them appear
      // offline even though they are logged in.
      auth: (cb: (data: Record<string, unknown>) => void) => {
        const token = localStorage.getItem('accessToken');
        cb(token ? { token } : {});
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Hook for real-time notification updates.
 * Listens on the user's personal room for new notifications,
 * invalidates TanStack queries to trigger refetch.
 */
export function useNotificationSocket(
  onNewNotification?: (notification: any) => void,
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    const s = getSocket();

    const handleNotification = (data: any) => {
      // Invalidate notification queries for fresh data
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      callbackRef.current?.(data);
    };

    s.on('notification', handleNotification);

    return () => {
      s.off('notification', handleNotification);
    };
  }, [queryClient]);
}

/**
 * Hook for real-time chat messages in a group. Listens on all the related
 * events (new message, edit, delete, reaction, read-receipt) and invalidates
 * the group query so consumers just re-read from cache.
 */
export function useChatSocket(
  groupId: string | undefined,
  onNewMessage?: (message: any) => void,
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!groupId) return;
    const s = getSocket();

    s.emit('chat:join', groupId);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    const handleMessage = (data: any) => {
      if (data.groupId === groupId) {
        invalidate();
        callbackRef.current?.(data);
      }
    };
    const handleEdit = (data: any) => { if (data.groupId === groupId) invalidate(); };
    const handleDelete = (data: any) => { if (data.groupId === groupId) invalidate(); };
    const handleReaction = (data: any) => { if (data.groupId === groupId) invalidate(); };
    const handleRead = (data: any) => { if (data.groupId === groupId) invalidate(); };

    s.on('chat:message', handleMessage);
    s.on('chat:message:edit', handleEdit);
    s.on('chat:message:delete', handleDelete);
    s.on('chat:message:reaction', handleReaction);
    s.on('chat:message:read', handleRead);

    return () => {
      s.emit('chat:leave', groupId);
      s.off('chat:message', handleMessage);
      s.off('chat:message:edit', handleEdit);
      s.off('chat:message:delete', handleDelete);
      s.off('chat:message:reaction', handleReaction);
      s.off('chat:message:read', handleRead);
    };
  }, [groupId, queryClient]);
}

/** Map of userId → typing state, with auto-expire after 4s of no keepalive. */
export function useTypingState(
  scope: { groupId?: string; partnerId?: string },
): { typing: Set<string>; emitTyping: (isTyping: boolean) => void } {
  const [typing, setTyping] = useState<Set<string>>(new Set());
  const expireTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    const s = getSocket();
    const handler = (evt: any) => {
      const matches =
        (scope.groupId && evt.groupId === scope.groupId) ||
        (scope.partnerId && !evt.groupId && evt.userId === scope.partnerId);
      if (!matches || !evt.userId) return;

      setTyping((prev) => {
        const next = new Set(prev);
        if (evt.isTyping) next.add(evt.userId);
        else next.delete(evt.userId);
        return next;
      });

      // Auto-drop stale typing indicators after 4s with no update.
      const existing = expireTimers.current.get(evt.userId);
      if (existing) clearTimeout(existing);
      if (evt.isTyping) {
        const t = setTimeout(() => {
          setTyping((prev) => {
            const next = new Set(prev);
            next.delete(evt.userId);
            return next;
          });
          expireTimers.current.delete(evt.userId);
        }, 4000);
        expireTimers.current.set(evt.userId, t);
      }
    };
    s.on('chat:typing', handler);
    return () => {
      s.off('chat:typing', handler);
      expireTimers.current.forEach((t) => clearTimeout(t));
      expireTimers.current.clear();
    };
  }, [scope.groupId, scope.partnerId]);

  const emitTyping = useCallback((isTyping: boolean) => {
    // Throttle to one emit per 2s while typing stays true.
    const now = Date.now();
    if (isTyping && now - lastEmitRef.current < 2000) return;
    lastEmitRef.current = now;
    getSocket().emit('chat:typing', {
      groupId: scope.groupId,
      recipientId: scope.partnerId,
      isTyping,
    });
  }, [scope.groupId, scope.partnerId]);

  return { typing, emitTyping };
}

/** Subscribe to presence updates for the given user IDs. */
export function usePresence(userIds: string[]): { online: Set<string>; lastSeen: Map<string, string> } {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Map<string, string>>(new Map());
  const idsKey = userIds.slice().sort().join(',');

  useEffect(() => {
    if (userIds.length === 0) return;
    const s = getSocket();

    // Seed initial state from a presence:query ack. Server returns either a
    // legacy boolean map or the richer { online, lastSeenAt } shape — handle
    // both so a server/client version skew doesn't break presence.
    const query = () => {
      s.emit('presence:query', userIds, (states: Record<string, any>) => {
        if (!states || typeof states !== 'object') return;
        setOnline((prev) => {
          const next = new Set(prev);
          Object.entries(states).forEach(([id, val]) => {
            const isOnline = typeof val === 'object' && val !== null ? !!val.online : !!val;
            if (isOnline) next.add(id); else next.delete(id);
          });
          return next;
        });
        setLastSeen((prev) => {
          const next = new Map(prev);
          Object.entries(states).forEach(([id, val]) => {
            if (typeof val === 'object' && val !== null && val.lastSeenAt) {
              next.set(id, val.lastSeenAt);
            }
          });
          return next;
        });
      });
    };
    query();
    s.on('connect', query);

    const handler = (evt: any) => {
      if (!userIds.includes(evt.userId)) return;
      setOnline((prev) => {
        const next = new Set(prev);
        if (evt.online) next.add(evt.userId);
        else next.delete(evt.userId);
        return next;
      });
      if (!evt.online && evt.lastSeenAt) {
        setLastSeen((prev) => {
          const next = new Map(prev);
          next.set(evt.userId, evt.lastSeenAt);
          return next;
        });
      }
    };
    s.on('presence:update', handler);
    return () => {
      s.off('presence:update', handler);
      s.off('connect', query);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { online, lastSeen };
}

/**
 * Hook for real-time DM updates. Listens on all related events and invalidates
 * the DM query. Also handles edit/delete/reaction/read receipts.
 */
export function useDMSocket(
  partnerId: string | undefined,
  onNewMessage?: (message: any) => void,
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    const s = getSocket();

    const matches = (data: any) =>
      partnerId && (data.senderId === partnerId || data.recipientId === partnerId);

    const handleDM = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      if (matches(data)) {
        queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
        callbackRef.current?.(data);
      }
    };
    const handleEdit = (data: any) => {
      if (matches(data)) queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
    };
    const handleDelete = (data: any) => {
      if (matches(data)) queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
    };
    const handleReaction = (data: any) => {
      if (matches(data)) queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
    };
    const handleRead = (data: any) => {
      if (matches(data)) queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
    };

    s.on('dm:message', handleDM);
    s.on('dm:message:edit', handleEdit);
    s.on('dm:message:delete', handleDelete);
    s.on('dm:message:reaction', handleReaction);
    s.on('dm:message:read', handleRead);

    return () => {
      s.off('dm:message', handleDM);
      s.off('dm:message:edit', handleEdit);
      s.off('dm:message:delete', handleDelete);
      s.off('dm:message:reaction', handleReaction);
      s.off('dm:message:read', handleRead);
    };
  }, [partnerId, queryClient]);
}

/**
 * Hook for real-time bus schedule updates.
 * Auto-invalidates bus queries when admin changes schedules.
 */
export function useBusSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    const handleBusUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['bus'] });
    };

    s.on('bus:updated', handleBusUpdate);

    return () => {
      s.off('bus:updated', handleBusUpdate);
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to real-time vote updates for a specific vote.
 */
export function useVoteSocket(
  voteId: string | undefined,
  onUpdate: (data: {
    voteId: string;
    totalVotes: number;
    options: Array<{ _id: string; text: string; voteCount: number }>;
  }) => void,
  onStatusChange?: (data: { voteId: string; status: string }) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  const onStatusRef = useRef(onStatusChange);
  onUpdateRef.current = onUpdate;
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (!voteId) return;

    const s = getSocket();
    s.emit('vote:join', voteId);

    const handleUpdate = (data: any) => {
      if (data.voteId === voteId) {
        onUpdateRef.current(data);
      }
    };

    const handleStatus = (data: any) => {
      if (data.voteId === voteId && onStatusRef.current) {
        onStatusRef.current(data);
      }
    };

    s.on('vote:updated', handleUpdate);
    s.on('vote:status', handleStatus);

    return () => {
      s.emit('vote:leave', voteId);
      s.off('vote:updated', handleUpdate);
      s.off('vote:status', handleStatus);
    };
  }, [voteId]);
}
