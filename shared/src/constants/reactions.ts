/** The one reaction vocabulary shared by announcements and chat, in picker order. */
export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'care', emoji: '🥰', label: 'Care' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
] as const;

export type ReactionType = (typeof REACTIONS)[number]['type'];

export const REACTION_TYPES: string[] = REACTIONS.map((r) => r.type);

/** Chat stored the emoji itself before the two surfaces shared a set, so old rows map back onto a name. */
const LEGACY_REACTION_EMOJI: Record<string, ReactionType> = {
  '👍': 'like',
  '👏': 'like',
  '❤️': 'love',
  '❤': 'love',
  '🥰': 'care',
  '🤗': 'care',
  '🙏': 'care',
  '😂': 'haha',
  '🤣': 'haha',
  '😮': 'wow',
  '😲': 'wow',
  '🔥': 'wow',
  '🎉': 'wow',
  '😢': 'sad',
  '😭': 'sad',
  '😡': 'angry',
  '😠': 'angry',
};

/** Whether a stored or submitted value belongs to the reaction set at all. */
export function isKnownReaction(key: string | null | undefined): boolean {
  return !!key && (REACTION_TYPES.includes(key) || key in LEGACY_REACTION_EMOJI);
}

/** The canonical name for a reaction, so a legacy emoji row counts in the same bucket as its named twin. */
export function normaliseReaction(
  key: string | null | undefined
): ReactionType | null {
  if (!key) return null;
  if (REACTION_TYPES.includes(key)) return key as ReactionType;
  return LEGACY_REACTION_EMOJI[key] || 'like';
}

export function reactionOf(key: string | null | undefined) {
  const type = normaliseReaction(key);
  return REACTIONS.find((r) => r.type === type);
}

export function reactionEmoji(key: string | null | undefined): string {
  return reactionOf(key)?.emoji || '👍';
}

export function reactionLabel(key: string | null | undefined): string {
  return reactionOf(key)?.label || 'Like';
}
