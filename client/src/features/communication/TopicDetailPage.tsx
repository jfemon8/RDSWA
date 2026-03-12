import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft, Pin, Lock, Send, Loader2, Trash2,
  User as UserIcon, Clock,
} from 'lucide-react';

import { FadeIn, BlurText } from '@/components/reactbits';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [replyContent, setReplyContent] = useState('');

  const isMod = user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);

  const { data, isLoading } = useQuery({
    queryKey: ['forum-topic', id],
    queryFn: async () => {
      const { data } = await api.get(`/communication/forum/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: () => api.post(`/communication/forum/${id}/reply`, { content: replyContent }),
    onSuccess: () => {
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (pinned: boolean) => api.patch(`/communication/forum/${id}`, { isPinned: pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-topic', id] }),
  });

  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => api.patch(`/communication/forum/${id}`, { isLocked: locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-topic', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/communication/forum/${id}`),
    onSuccess: () => navigate('/dashboard/forum'),
  });

  const topic = data?.topic;
  const replies = data?.replies || [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!topic) {
    return <div className="text-center py-12 text-muted-foreground">Topic not found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/forum')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Forum
      </button>

      {/* Topic */}
      <FadeIn direction="up" distance={20}>
        <div className="bg-card border rounded-lg p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {topic.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                {topic.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {topic.category || 'General'}
                </span>
              </div>
              <BlurText text={topic.title} className="text-xl font-bold" delay={30} />
            </div>

            {/* Mod actions */}
            {isMod && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => pinMutation.mutate(!topic.isPinned)}
                  className={`p-2 rounded-md ${topic.isPinned ? 'text-amber-500' : 'text-muted-foreground'} hover:bg-accent`}
                  title={topic.isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  onClick={() => lockMutation.mutate(!topic.isLocked)}
                  className={`p-2 rounded-md ${topic.isLocked ? 'text-red-500' : 'text-muted-foreground'} hover:bg-accent`}
                  title={topic.isLocked ? 'Unlock' : 'Lock'}
                >
                  <Lock className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this topic?')) deleteMutation.mutate(); }}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm whitespace-pre-wrap">{topic.content}</div>

          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground pt-3 border-t">
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {topic.author?.name || 'Unknown'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(topic.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Replies */}
      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h3>
        {replies.map((reply: any, i: number) => (
          <FadeIn key={reply._id} delay={i * 0.03} direction="up" distance={12}>
            <div
              className="bg-card border rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {reply.author?.avatar ? (
                    <img src={reply.author.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{reply.author?.name || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Reply form */}
      {topic.isLocked ? (
        <div className="text-center py-4 text-sm text-muted-foreground bg-muted rounded-lg">
          <Lock className="h-4 w-4 inline mr-1" /> This topic is locked
        </div>
      ) : (
        <FadeIn delay={0.1} direction="up">
          <div className="flex gap-2">
            <textarea
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={2}
              className="flex-1 px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => replyMutation.mutate()}
              disabled={!replyContent.trim() || replyMutation.isPending}
              className="self-end px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {replyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { dateStyle: 'medium' });
}
