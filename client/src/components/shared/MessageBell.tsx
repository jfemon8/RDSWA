import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/hooks/useSocket';

/** Top-navigation bell showing a live unread badge for DMs and group messages, linking to the chat hub. */
export default function MessageBell() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['message-unread-count'],
    queryFn: async () => {
      const res = await api.get('/communication/messages/unread-count');
      return res.data.data as { count: number };
    },
    refetchInterval: 60_000,
    enabled: !!user,
  });

  // Invalidate the count in real-time when new DMs or group messages arrive
  // or when the user marks messages read.
  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ['message-unread-count'] });

    // `chat:*` only reaches sockets inside that group's room, which the badge is never in — group
    // traffic arrives on the personal room as `chat:group:activity` instead.
    s.on('dm:message', invalidate);
    s.on('dm:message:read', invalidate);
    s.on('dm:message:delete', invalidate);
    s.on('chat:group:activity', invalidate);

    return () => {
      s.off('dm:message', invalidate);
      s.off('dm:message:read', invalidate);
      s.off('dm:message:delete', invalidate);
      s.off('chat:group:activity', invalidate);
    };
  }, [user, queryClient]);

  const unread = data?.count || 0;

  return (
    <Link
      to="/dashboard/chat"
      className="relative tap-target flex items-center justify-center rounded-md hover:bg-accent transition-colors"
      aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
    >
      <MessageSquare className="h-5 w-5" />
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            aria-live="polite"
            className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
