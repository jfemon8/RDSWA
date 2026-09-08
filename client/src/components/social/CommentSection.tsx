import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Send, User as UserIcon } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { hasMinRole } from "@/lib/roles";
import { UserRole } from "@rdswa/shared";
import ReactionButton from "./ReactionButton";
import { EMPTY_SUMMARY, topReactions, type ReactionSummary } from "./reactions";

interface Comment {
  _id: string;
  content: string;
  author?: { _id: string; name: string; avatar?: string };
  createdAt: string;
  isEdited?: boolean;
  reactionSummary: ReactionSummary;
  replies?: Comment[];
}

/** Short relative age, the way a feed timestamps its comments. */
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function Avatar({
  user,
  size = "h-8 w-8",
}: {
  user?: Comment["author"];
  size?: string;
}) {
  if (user?.avatar)
    return (
      <img
        src={user.avatar}
        alt=""
        className={`${size} rounded-full object-cover shrink-0`}
      />
    );
  return (
    <div
      className={`${size} rounded-full bg-muted flex items-center justify-center shrink-0`}
    >
      <UserIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export default function CommentSection({
  announcementId,
}: {
  announcementId: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  // Reacting is open to every signed-in account; writing needs a membership, moderating a moderator.
  const canWrite = !!user?.role && hasMinRole(user.role, UserRole.MEMBER);
  const isModerator = !!user?.role && hasMinRole(user.role, UserRole.MODERATOR);

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Long threads collapse the way a feed does, with the newest few kept in view.
  const [showAll, setShowAll] = useState(false);
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set());

  const key = ["announcement-comments", announcementId];
  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: key,
    queryFn: async () =>
      (await api.get(`/communication/announcements/${announcementId}/comments`))
        .data.data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const postMutation = useMutation({
    mutationFn: (vars: { content: string; parentId?: string }) =>
      api.post(`/communication/announcements/${announcementId}/comments`, vars),
    onSuccess: (_d, vars) => {
      refresh();
      if (vars.parentId) {
        setReplyDraft("");
        setReplyTo(null);
      } else setDraft("");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "Failed to comment"),
  });

  const editMutation = useMutation({
    mutationFn: (vars: { id: string; content: string }) =>
      api.patch(`/communication/announcements/comments/${vars.id}`, {
        content: vars.content,
      }),
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setEditDraft("");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "Failed to edit"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/communication/announcements/comments/${id}`),
    onSuccess: () => {
      refresh();
      toast.success("Comment deleted");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "Failed to delete"),
  });

  const reactMutation = useMutation({
    mutationFn: (vars: { id: string; type: string | null }) =>
      api.post(`/communication/announcements/comments/${vars.id}/react`, {
        type: vars.type,
      }),
    onSuccess: () => refresh(),
  });

  const total = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length || 0),
    0,
  );
  const visible = showAll ? comments : comments.slice(-3);
  const canManage = (c: Comment) => isModerator || c.author?._id === user?._id;

  const renderComment = (c: Comment, isReply = false) => {
    const summary = c.reactionSummary || EMPTY_SUMMARY;
    const emojis = topReactions(summary, 2);

    return (
      <motion.div
        key={c._id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-2 ${isReply ? "ml-8 sm:ml-10" : ""}`}
      >
        <Avatar user={c.author} size={isReply ? "h-7 w-7" : "h-8 w-8"} />
        <div className="min-w-0 flex-1">
          {editingId === c._id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editDraft.trim())
                  editMutation.mutate({ id: c._id, content: editDraft });
              }}
              className="flex items-center gap-2"
            >
              <input
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditDraft("");
                  }
                }}
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-2xl bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={editMutation.isPending}
                className="text-xs text-primary font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditDraft("");
                }}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="relative inline-block max-w-full">
              <div className="rounded-2xl bg-muted px-3 py-2">
                <Link
                  to={`/members/${c.author?._id}`}
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {c.author?.name || "Unknown"}
                </Link>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                  {c.content}
                </p>
              </div>
              {summary.total > 0 && (
                <div className="absolute -bottom-2 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-card border shadow-sm text-[11px]">
                  {emojis.map((e, i) => (
                    <span key={i}>{e}</span>
                  ))}
                  <span className="text-muted-foreground">{summary.total}</span>
                </div>
              )}
            </div>
          )}

          {editingId !== c._id && (
            <div className="flex items-center gap-3 mt-1.5 ml-3 text-xs text-muted-foreground">
              <ReactionButton
                compact
                summary={summary}
                onReact={(type) => reactMutation.mutate({ id: c._id, type })}
              />
              {!isReply && canWrite && (
                <button
                  onClick={() => {
                    setReplyTo(replyTo === c._id ? null : c._id);
                    setReplyDraft("");
                  }}
                  className="font-semibold hover:text-foreground"
                >
                  Reply
                </button>
              )}
              {canManage(c) && (
                <>
                  <button
                    onClick={() => {
                      setEditingId(c._id);
                      setEditDraft(c.content);
                    }}
                    className="font-semibold hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Delete Comment",
                        message:
                          "Delete this comment? Any replies to it go too.",
                        confirmLabel: "Delete",
                        variant: "danger",
                      });
                      if (ok) deleteMutation.mutate(c._id);
                    }}
                    className="font-semibold hover:text-destructive"
                  >
                    Delete
                  </button>
                </>
              )}
              <span>{timeAgo(c.createdAt)}</span>
              {c.isEdited && <span className="italic">Edited</span>}
            </div>
          )}

          {!isReply && (c.replies?.length || 0) > 0 && (
            <div className="mt-2 space-y-2">
              {(openReplies.has(c._id) ? c.replies! : c.replies!.slice(-1)).map(
                (r) => renderComment(r, true),
              )}
              {c.replies!.length > 1 && !openReplies.has(c._id) && (
                <button
                  onClick={() =>
                    setOpenReplies((prev) => new Set(prev).add(c._id))
                  }
                  className="ml-8 sm:ml-10 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  View {c.replies!.length - 1} more{" "}
                  {c.replies!.length - 1 === 1 ? "reply" : "replies"}
                </button>
              )}
            </div>
          )}

          <AnimatePresence>
            {replyTo === c._id && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyDraft.trim())
                    postMutation.mutate({
                      content: replyDraft,
                      parentId: c._id,
                    });
                }}
                className="overflow-hidden ml-8 sm:ml-10 mt-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar user={user as any} size="h-7 w-7" />
                  <input
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder={`Reply to ${c.author?.name?.split(" ")[0] || "comment"}...`}
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-full bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="submit"
                    disabled={!replyDraft.trim() || postMutation.isPending}
                    aria-label="Send reply"
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full border bg-muted text-primary transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-muted"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {comments.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              View more comments
            </button>
          )}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {visible.map((c) => renderComment(c))}
            </AnimatePresence>
          </div>
          {total === 0 && (
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first.
            </p>
          )}
        </>
      )}

      {!canWrite ? (
        <p className="text-xs text-muted-foreground pt-1">
          Only approved members can comment. You can still react to this
          announcement.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) postMutation.mutate({ content: draft });
          }}
          className="flex items-center gap-1 md:gap-2"
        >
          <Avatar user={user as any} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 p-2 md:px-4 rounded-full bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!draft.trim() || postMutation.isPending}
            aria-label="Post comment"
            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full border bg-muted text-primary transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-muted"
          >
            {postMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
