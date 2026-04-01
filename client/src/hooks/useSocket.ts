import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(socketUrl, {
      path: '/socket.io',
      auth: token ? { token } : {},
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
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
 * Hook for real-time chat messages in a group.
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

    const handleMessage = (data: any) => {
      if (data.groupId === groupId) {
        queryClient.invalidateQueries({ queryKey: ['group', groupId] });
        callbackRef.current?.(data);
      }
    };

    s.on('chat:message', handleMessage);

    return () => {
      s.emit('chat:leave', groupId);
      s.off('chat:message', handleMessage);
    };
  }, [groupId, queryClient]);
}

/**
 * Hook for real-time DM updates.
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

    const handleDM = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      if (partnerId && (data.senderId === partnerId || data.recipientId === partnerId)) {
        queryClient.invalidateQueries({ queryKey: ['dm', partnerId] });
        callbackRef.current?.(data);
      }
    };

    s.on('dm:message', handleDM);

    return () => {
      s.off('dm:message', handleDM);
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
