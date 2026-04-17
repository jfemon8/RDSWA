import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft, Pin, Lock, Send, Loader2, Trash2, Pencil,
  User as UserIcon, Clock, MessageSquare,
} from 'lucide-react';
import Spinner from '@/components/ui/Spinner';

import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import RichContent from '@/components/ui/RichContent';
import { extractFieldErrors } from '@/lib/formErrors';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { formatDate } from '@/lib/date';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import { useToast } from '@/components/ui/Toast';

export default function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [replyContent, setReplyContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicContent, setEditTopicContent] = useState('');

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
      toast.success('Reply posted!');
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        toast.error(Object.values(fieldErrors)[0]);
      } else {
        toast.error(err?.response?.data?.message || 'Failed to post reply');
      }
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

  const editTopicMutation = useMutation({
    mutationFn: () => api.patch(`/communication/forum/${id}`, { title: editTopicTitle, content: editTopicContent }),
    onSuccess: () => {
      setEditingTopic(false);
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
      toast.success('Topic updated!');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update topic'),
  });

  const editReplyMutation = useMutation({
    mutationFn: ({ replyId, content }: { replyId: string; content: string }) =>
      api.patch(`/communication/forum/${id}/reply/${replyId}`, { content }),
    onSuccess: () => {
      setEditingReplyId(null);
      setEditReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
      toast.success('Reply updated!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update reply');
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: string) => api.delete(`/communication/forum/${id}/reply/${replyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topic', id] });
      toast.success('Reply deleted');
    },
  });

  const topic = data?.topic;
  const replies = data?.replies || [];

  if (isLoading) {
    return <Spinner size="md" />;
  }

  if (!topic) {
    return <div className="text-center py-12 text-muted-foreground">Topic not found</div>;
  }

  return (
    <div className="container mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard/forum')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Forum
      </button>

      {/* Topic */}
      <FadeIn direction="up" distance={20}>
        <div className="bg-card border rounded-lg p-4 sm:p-5 mb-4">
          {/* Meta row: category chip + pin/lock indicators + action icons.
              Actions sit on their own row end so the title below can use the
              full card width and wrap naturally (BlurText's flex-wrap layout
              forced one-word-per-line in the narrow leftover space). */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              {topic.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
              {topic.isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {topic.category || 'General'}
              </span>
            </div>
            <div className="flex gap-0.5 shrink-0">
              {(user?._id === topic.author?._id || isMod) && !editingTopic && (
                <button
                  onClick={() => { setEditingTopic(true); setEditTopicTitle(topic.title); setEditTopicContent(topic.content); }}
                  className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-accent"
                  title="Edit topic"
                  aria-label="Edit topic"
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
              {isMod && (
                <>
                  <button
                    onClick={() => pinMutation.mutate(!topic.isPinned)}
                    className={`p-1.5 sm:p-2 rounded-md ${topic.isPinned ? 'text-amber-500' : 'text-muted-foreground'} hover:bg-accent`}
                    title={topic.isPinned ? 'Unpin' : 'Pin'}
                    aria-label={topic.isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => lockMutation.mutate(!topic.isLocked)}
                    className={`p-1.5 sm:p-2 rounded-md ${topic.isLocked ? 'text-red-500' : 'text-muted-foreground'} hover:bg-accent`}
                    title={topic.isLocked ? 'Unlock' : 'Lock'}
                    aria-label={topic.isLocked ? 'Unlock' : 'Lock'}
                  >
                    <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={async () => { const ok = await confirm({ title: 'Delete Topic', message: 'Are you sure you want to delete this topic? This action cannot be undone.', confirmLabel: 'Delete', variant: 'danger' }); if (ok) deleteMutation.mutate(); }}
                    className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <h1 className="text-lg sm:text-xl font-bold break-words leading-snug">{topic.title}</h1>

          {editingTopic ? (
            <div className="mt-4 space-y-3">
              <input
                value={editTopicTitle}
                onChange={(e) => setEditTopicTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Topic title"
              />
              <textarea
                value={editTopicContent}
                onChange={(e) => setEditTopicContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Topic content..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => editTopicMutation.mutate()}
                  disabled={!editTopicTitle.trim() || !editTopicContent.trim() || editTopicMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {editTopicMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Save
                </button>
                <button
                  onClick={() => setEditingTopic(false)}
                  className="px-4 py-1.5 text-sm border rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <RichContent html={topic.content} className="mt-4 text-sm" />
          )}

          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground pt-3 border-t">
            <Link to={`/members/${topic.author?._id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
              <UserIcon className="h-3 w-3" />
              {topic.author?.name || 'Unknown'}
            </Link>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(topic.createdAt)}
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Replies */}
      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h3>
        {replies.map((reply: any, i: number) => {
          const isOwner = reply.author?._id === user?._id;
          const canEdit = isOwner;
          const canDelete = isOwner || isMod;

          return (
            <FadeIn key={reply._id} delay={i * 0.03} direction="up" distance={12}>
              <div className="bg-card border rounded-lg p-4 group">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {reply.author?.avatar ? (
                      <img src={reply.author.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/members/${reply.author?._id}`} className="text-sm font-medium hover:text-primary transition-colors">{reply.author?.name || 'Unknown'}</Link>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(reply.createdAt)}
                        </span>
                      </div>
                      {(canEdit || canDelete) && editingReplyId !== reply._id && (
                        // Mobile (touch): always visible — :hover doesn't work
                        // reliably on touch. Desktop: hover-revealed to stay
                        // visually calm. Uses sm: because touch/hover tends
                        // to correlate with viewport in this app.
                        <div className="flex gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                          {canEdit && (
                            <button
                              onClick={() => { setEditingReplyId(reply._id); setEditReplyContent(reply.content); }}
                              className="p-1 rounded hover:bg-accent"
                              title="Edit"
                              aria-label="Edit reply"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({ title: 'Delete Reply', message: 'Delete this reply?', confirmLabel: 'Delete', variant: 'danger' });
                                if (ok) deleteReplyMutation.mutate(reply._id);
                              }}
                              className="p-1 rounded hover:bg-accent"
                              title="Delete"
                              aria-label="Delete reply"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {editingReplyId === reply._id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editReplyContent}
                          onChange={(e) => setEditReplyContent(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => { setEditingReplyId(null); setEditReplyContent(''); }}
                            className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded-md"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (editReplyContent.trim()) {
                                editReplyMutation.mutate({ replyId: reply._id, content: editReplyContent });
                              }
                            }}
                            disabled={editReplyMutation.isPending}
                            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                          >
                            {editReplyMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <RichContent html={reply.content} className="text-sm" />
                    )}
                  </div>
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {/* Reply form */}
      {topic.isLocked ? (
        <div className="text-center py-4 text-sm text-muted-foreground bg-muted rounded-lg">
          <Lock className="h-4 w-4 inline mr-1" /> This topic is locked
        </div>
      ) : (
        <FadeIn delay={0.1} direction="up">
          <form onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            if (!replyContent.trim()) { setErrors({ replyContent: 'Reply content is required' }); return; }
            replyMutation.mutate();
          }} noValidate className="space-y-1">
            {/* FieldError intentionally rendered OUTSIDE the flex row so it
                doesn't inflate the row height — otherwise the stretched
                button would grow taller than the textarea. */}
            <div className="flex items-stretch gap-2">
              <textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => { setReplyContent(e.target.value); setErrors((prev) => { const { replyContent, ...rest } = prev; return rest; }); }}
                rows={2}
                className={`flex-1 min-w-0 px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.replyContent ? 'border-red-500' : ''}`}
              />
              <button
                type="submit"
                disabled={!replyContent.trim() || replyMutation.isPending}
                aria-label="Send reply"
                className="shrink-0 w-12 flex items-center justify-center bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {replyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <FieldError message={errors.replyContent} />
          </form>
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
  return formatDate(dateStr);
}
