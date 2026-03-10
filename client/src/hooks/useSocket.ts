import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    socket = io(window.location.origin, {
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
