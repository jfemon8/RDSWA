import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

import { FadeIn } from '@/components/reactbits';
import { formatDate, formatTime } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import { normalizeNotificationLink } from '@/lib/notificationLink';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import RichContent from '@/components/ui/RichContent';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=50');
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      toast.success('Notification removed');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  // Click on a notification → mark as read (optimistic, fire-and-forget) and
  // navigate to its linked page, Facebook-style. If the notification has no
  // `link`, we still mark it read but stay on the page.
  // `normalizeNotificationLink` rewrites legacy API-path prefixes like
  // `/communication/groups/...` → `/dashboard/groups/...` so old notifications
  // still stored in the DB (before the server-side fix) don't hit 404.
  const handleNotificationClick = (n: any) => {
    if (!n.isRead) markReadMutation.mutate(n._id);
    const target = normalizeNotificationLink(n.link);
    if (target) navigate(target);
  };

  const notifications = data?.data || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  if (isLoading) {
    return <Spinner size="md" />;
  }

  return (
    <div className="container mx-auto">
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
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNotificationClick(n);
                  }
                }}
                className={`p-4 rounded-lg border flex items-start justify-between gap-4 cursor-pointer hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors ${
                  n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    {!n.isRead && (
                      <span
                        className="h-2 w-2 rounded-full bg-primary shrink-0"
                        aria-label="Unread"
                      />
                    )}
                    <Bell className="h-3.5 w-3.5 text-primary shrink-0" /> {n.title}
                  </p>
                  {/* Notification messages may be plain text (with \n line
                      breaks and tabs) or rich HTML. RichContent's prose
                      styling collapses whitespace, so plain text with
                      newlines would render as one flowing paragraph. Detect
                      HTML by looking for any tag — fall back to a
                      whitespace-preserving paragraph otherwise. */}
                  {/<[a-z][\s\S]*>/i.test(n.message || '') ? (
                    <RichContent html={n.message} className="text-sm text-muted-foreground mt-1 text-justify" />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-justify">
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(n.createdAt)}
                    {' '}
                    {formatTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async (e) => {
                      // Stop the card's click handler from also firing —
                      // otherwise we'd navigate + delete in the same tap.
                      e.stopPropagation();
                      const ok = await confirm({ title: 'Delete Notification', message: 'Remove this notification from your list?', confirmLabel: 'Delete', variant: 'danger' });
                      if (ok) deleteMutation.mutate(n._id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 disabled:opacity-50"
                    title="Delete"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
