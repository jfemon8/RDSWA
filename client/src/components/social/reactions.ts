/** The reaction set offered on announcements and their comments, in picker order. */
export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like', color: 'text-blue-600' },
  { type: 'love', emoji: '❤️', label: 'Love', color: 'text-red-500' },
  { type: 'care', emoji: '🥰', label: 'Care', color: 'text-amber-500' },
  { type: 'haha', emoji: '😂', label: 'Haha', color: 'text-amber-500' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-amber-500' },
  { type: 'sad', emoji: '😢', label: 'Sad', color: 'text-amber-500' },
  { type: 'angry', emoji: '😡', label: 'Angry', color: 'text-orange-600' },
] as const;

export type ReactionType = (typeof REACTIONS)[number]['type'];

export interface ReactionSummary {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
}

export const EMPTY_SUMMARY: ReactionSummary = { counts: {}, total: 0, mine: null };

export const reactionOf = (type: string | null | undefined) =>
  REACTIONS.find((r) => r.type === type);

/** The reaction emojis to show on the count, most used first and capped like a social feed does. */
export function topReactions(summary: ReactionSummary, limit = 3): string[] {
  return Object.entries(summary.counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type]) => reactionOf(type)?.emoji || '👍')
    .filter(Boolean);
}
