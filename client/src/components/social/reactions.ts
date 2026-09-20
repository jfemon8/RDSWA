/** The reaction set offered on announcements and their comments, in picker order. */
export const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like", color: "text-blue-600" },
  { type: "love", emoji: "❤️", label: "Love", color: "text-red-500" },
  { type: "care", emoji: "🥰", label: "Care", color: "text-amber-500" },
  { type: "haha", emoji: "😂", label: "Haha", color: "text-amber-500" },
  { type: "wow", emoji: "😮", label: "Wow", color: "text-amber-500" },
  { type: "sad", emoji: "😢", label: "Sad", color: "text-amber-500" },
  { type: "angry", emoji: "😡", label: "Angry", color: "text-orange-600" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

export interface ReactionSummary {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
}

export interface ReactionUser {
  type: string;
  reactedAt?: string;
  user: { _id: string; name?: string; avatar?: string };
}

export const EMPTY_SUMMARY: ReactionSummary = {
  counts: {},
  total: 0,
  mine: null,
};

export const reactionOf = (type: string | null | undefined) =>
  REACTIONS.find((r) => r.type === type);

export interface TopReaction {
  type: string;
  emoji: string;
  count: number;
}

/** The reactions to show on the count, most used first, capped, and never the same emoji twice. */
export function topReactionEntries(
  summary: ReactionSummary,
  limit = 3,
): TopReaction[] {
  const seen = new Set<string>();
  const out: TopReaction[] = [];
  for (const [type, count] of Object.entries(summary.counts || {}).sort(
    (a, b) => b[1] - a[1],
  )) {
    const emoji = reactionOf(type)?.emoji || "👍";
    if (seen.has(emoji)) continue;
    seen.add(emoji);
    out.push({ type, emoji, count });
    if (out.length === limit) break;
  }
  return out;
}

/** The reaction emojis to show on the count, most used first and capped like a social feed does. */
export function topReactions(summary: ReactionSummary, limit = 3): string[] {
  return topReactionEntries(summary, limit).map((r) => r.emoji);
}
