import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Star, ArrowRight, MessageSquare, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate, formatTime } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

interface StarredMessage {
  _id: string;
  content: string;
  sender?: { _id: string; name?: string; avatar?: string };
  group?: { _id: string; name: string; type: string };
  recipient?: string;
  createdAt: string;
  attachments?: Array<{ kind?: string; name?: string }>;
}

export default function StarredMessagesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['messages', 'starred'],
    queryFn: async () => {
      const { data } = await api.get('/communication/messages/starred');
      return data;
    },
  });

  const unstarMutation = useMutation({
    mutationFn: (messageId: string) => api.post(`/communication/messages/${messageId}/star`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'starred'] });
      toast.success('Unstarred');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to unstar'),
  });

  const messages: StarredMessage[] = data?.data || [];

  /** Build a deep-link back to the original conversation. */
  const getLink = (m: StarredMessage): string => {
    if (m.group?._id) return `/dashboard/groups/${m.group._id}#msg-${m._id}`;
    // DM: the other side is either sender or recipient
    const partnerId = m.recipient || m.sender?._id;
    if (partnerId) return `/dashboard/messages?with=${partnerId}#msg-${m._id}`;
    return '/dashboard/messages';
  };

  return (
    <div className="container mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
        <BlurText
          text="Starred Messages"
          className="text-2xl sm:text-3xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
      </div>

      {isLoading ? (
        <Spinner size="md" />
      ) : messages.length === 0 ? (
        <FadeIn delay={0.1} direction="up">
          <div className="text-center py-16 text-sm text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No starred messages yet.</p>
            <p className="text-xs mt-1">Long-press or right-click any message and tap "Star" to save it here.</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          {messages.map((m, i) => (
            <FadeIn key={m._id} direction="up" delay={i * 0.04}>
              <motion.div
                whileHover={{ y: -1 }}
                className="border rounded-lg p-4 bg-card flex items-start gap-3"
              >
                {m.sender?.avatar ? (
                  <img src={m.sender.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {m.sender?.name || 'Unknown sender'}
                    </span>
                    {m.group?.name && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MessageSquare className="h-3 w-3" /> {m.group.name}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      · {formatDate(m.createdAt)} {formatTime(m.createdAt)}
                    </span>
                  </div>
                  {m.content && (
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                  )}
                  {m.attachments && m.attachments.length > 0 && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">
                      📎 {m.attachments.length} attachment{m.attachments.length > 1 ? 's' : ''}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Link
                      to={getLink(m)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Jump to conversation <ArrowRight className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => unstarMutation.mutate(m._id)}
                      disabled={unstarMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-600 disabled:opacity-50"
                      title="Remove from starred"
                    >
                      <Star className="h-3 w-3 fill-current" /> Unstar
                    </button>
                  </div>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
