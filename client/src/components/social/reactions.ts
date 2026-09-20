import {
  REACTIONS as SHARED_REACTIONS,
  normaliseReaction,
  type ReactionType,
} from "@rdswa/shared";

export { normaliseReaction };
export type { ReactionType };

/** The tint each reaction is labelled with, the one thing outside its shared definition. */
const REACTION_COLORS: Record<string, string> = {
  like: "text-blue-600",
  love: "text-red-500",
  care: "text-amber-500",
  haha: "text-amber-500",
  wow: "text-amber-500",
  sad: "text-amber-500",
  angry: "text-orange-600",
};

/** The reaction set offered on announcements, comments and chat, in picker order. */
export const REACTIONS = SHARED_REACTIONS.map((r) => ({
  ...r,
  color: REACTION_COLORS[r.type],
}));

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

/** Legacy rows still carry a raw emoji, so every lookup goes through the canonical name first. */
export const reactionOf = (type: string | null | undefined) =>
  REACTIONS.find((r) => r.type === normaliseReaction(type));

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

/** Just the emojis of the top reactions, for callers that show no counts. */
export function topReactions(summary: ReactionSummary, limit = 3): string[] {
  return topReactionEntries(summary, limit).map((r) => r.emoji);
}
