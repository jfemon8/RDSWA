import { motion } from 'motion/react';

export interface ReactionItem {
  user: { _id: string; name?: string; avatar?: string } | string;
  emoji: string;
}

interface Props {
  reactions: ReactionItem[];
  currentUserId?: string;
  onToggle?: (emoji: string) => void;
  align?: 'start' | 'end';
}

/**
 * Renders the aggregated reaction chips under a message bubble.
 * Clicking a chip you already reacted with toggles the reaction off (server enforces).
 */
export default function ReactionBar({ reactions, currentUserId, onToggle, align = 'start' }: Props) {
  if (!reactions || reactions.length === 0) return null;

  // Group by emoji → [{ emoji, count, mine }]
  const counts = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const entry = counts.get(r.emoji) || { count: 0, mine: false };
    entry.count++;
    const uid = typeof r.user === 'string' ? r.user : r.user?._id;
    if (uid && uid === currentUserId) entry.mine = true;
    counts.set(r.emoji, entry);
  }
  const items = Array.from(counts.entries());

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {items.map(([emoji, { count, mine }]) => (
        <motion.button
          key={emoji}
          type="button"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onToggle?.(emoji); }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] leading-none transition-colors ${
            mine
              ? 'bg-primary/15 border-primary/40 text-primary'
              : 'bg-background border-border hover:bg-accent'
          }`}
          title={`${count} reaction${count > 1 ? 's' : ''}`}
        >
          <span className="text-sm">{emoji}</span>
          {count > 1 && <span className="font-medium">{count}</span>}
        </motion.button>
      ))}
    </div>
  );
}
