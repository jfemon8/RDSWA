import { useState } from "react";
import { motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Megaphone,
  MessageCircle,
  User as UserIcon,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { formatDate } from "@/lib/date";
import { FadeIn } from "@/components/reactbits";
import RichContent from "@/components/ui/RichContent";
import ReactionButton from "@/components/social/ReactionButton";
import CommentSection from "@/components/social/CommentSection";
import ReactorsModal from "@/components/social/ReactorsModal";
import {
  EMPTY_SUMMARY,
  reactionOf,
  topReactionEntries,
  type ReactionUser,
} from "@/components/social/reactions";
import { parseAnnouncement } from "./announcementFormat";

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useBackNavigation("/dashboard/announcements");
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const key = ["announcement", id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await api.get(`/communication/announcements/${id}`)).data.data,
    enabled: !!id,
  });

  const reactMutation = useMutation({
    mutationFn: (type: string | null) =>
      api.post(`/communication/announcements/${id}/react`, { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["announcement-reactors", id] });
    },
  });

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ["announcement-comments", id],
    queryFn: async () =>
      (await api.get(`/communication/announcements/${id}/comments`)).data.data,
    enabled: !!id,
  });

  // The reactor list opens on a specific reaction when one of the emojis is what was pressed.
  const [reactorsTab, setReactorsTab] = useState<string | null | undefined>(
    undefined,
  );

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="container mx-auto py-16 text-center">
        <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground mb-3">
          This announcement doesn't exist or was removed.
        </p>
        <Link
          to="/dashboard/announcements"
          className="text-primary hover:underline"
        >
          Back to announcements
        </Link>
      </div>
    );
  }

  const { title, body } = parseAnnouncement(data.content);
  const image = data.attachments?.find((a: any) => a.kind === "image");
  const summary = data.reactionSummary || EMPTY_SUMMARY;
  const reactionUsers = (data.reactionUsers || []) as ReactionUser[];
  const topReactions = topReactionEntries(summary);
  const commentCount = comments.reduce(
    (sum, c) => sum + 1 + (c.replies?.length || 0),
    0,
  );

  // "You, Rahim and 4 others" - the same shorthand a social feed puts under a post.
  const named = reactionUsers
    .filter((entry) => entry.user?._id !== user?._id)
    .map((entry) => entry.user?.name?.split(" ")[0] || "Someone");
  const leading = [...(summary.mine ? ["You"] : []), ...named.slice(0, 2)];
  const remaining = summary.total - leading.length;
  const reactorLabel = summary.total
    ? remaining > 0
      ? `${leading.join(", ")} and ${remaining} other${remaining > 1 ? "s" : ""}`
      : leading.join(", ")
    : "";

  return (
    <div className="container mx-auto">
      {/* On a phone the system and bottom navigation already cover going back. */}
      <button
        type="button"
        onClick={goBack}
        className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to announcements
      </button>

      <div className="space-y-4">
        <FadeIn direction="up">
          <article className="bg-card border rounded-xl overflow-hidden">
            <div className="relative bg-gradient-to-br from-amber-500/10 via-primary/5 to-transparent px-5 py-6 sm:px-8 sm:py-8 border-b">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words leading-tight">
                {title}
              </h1>

              <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground flex-wrap">
                <Link
                  to={`/members/${data.sender?._id}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  {data.sender?.avatar ? (
                    <img
                      src={data.sender.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-background"
                    />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <UserIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="font-medium text-foreground text-sm">
                    {data.sender?.name || "Unknown"}
                  </span>
                </Link>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDate(data.createdAt)}
                </span>
                {data.isEdited && <span className="italic">edited</span>}
              </div>
            </div>

            {image?.url && (
              <img
                src={image.url}
                alt=""
                className="w-full max-h-[32rem] object-contain bg-muted/40"
                loading="lazy"
              />
            )}

            <div className="px-5 py-6 sm:px-8">
              <RichContent
                html={body}
                className="text-[15px] text-foreground leading-relaxed"
              />
            </div>

            <div className="px-5 sm:px-8 pb-5 sm:pb-6 space-y-3">
              {/* Pressing the count opens the reactor list, the way a social feed does. */}
              {summary.total > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="flex">
                      {topReactions.map((r) => (
                        <motion.button
                          key={r.type}
                          type="button"
                          onClick={() => setReactorsTab(r.type)}
                          whileHover={{ scale: 1.25, y: -2 }}
                          whileTap={{ scale: 1.05 }}
                          title={`${r.count} ${reactionOf(r.type)?.label || "reaction"}`}
                          aria-label={`See who reacted ${reactionOf(r.type)?.label || ""}`}
                          className="-ml-1.5 first:ml-0 text-base leading-none"
                        >
                          {r.emoji}
                        </motion.button>
                      ))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReactorsTab(null)}
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      {reactorLabel}
                    </button>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {commentCount} {commentCount === 1 ? "comment" : "comments"}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <ReactionButton
                  summary={summary}
                  onReact={(type) => reactMutation.mutate(type)}
                  disabled={reactMutation.isPending}
                />
                {summary.total === 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {commentCount} {commentCount === 1 ? "comment" : "comments"}
                  </span>
                )}
              </div>
            </div>
          </article>
        </FadeIn>

        <FadeIn direction="up" delay={0.08}>
          <section className="bg-card border rounded-xl">
            <h2 className="px-5 py-3 sm:px-8 border-b text-sm font-semibold text-foreground">
              Discussion{" "}
              {commentCount > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({commentCount})
                </span>
              )}
            </h2>
            <div className="px-5 py-5 sm:px-8">
              <CommentSection announcementId={id!} />
            </div>
          </section>
        </FadeIn>
      </div>

      <ReactorsModal
        open={reactorsTab !== undefined}
        onClose={() => setReactorsTab(undefined)}
        announcementId={id!}
        initialType={reactorsTab ?? null}
      />
    </div>
  );
}
