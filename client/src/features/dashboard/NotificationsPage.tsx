import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';

import { FadeIn } from '@/components/reactbits';
import { formatDate, formatTime } from '@/lib/date';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=50');
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <p className="text-sm text-muted-foreground mb-4">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any, i: number) => (
            <FadeIn key={n._id} delay={i * 0.03} direction="up" distance={15}>
              <div
                className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
                  n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(n.createdAt)}
                    {' '}
                    {formatTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markReadMutation.mutate(n._id)}
                    className="p-2 text-muted-foreground hover:text-primary rounded-md hover:bg-accent shrink-0"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
