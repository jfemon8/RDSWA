import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { REACTIONS, reactionOf } from '@/components/social/reactions';

export interface ReactionItem {
  user: { _id: string; name?: string; avatar?: string } | string;
  emoji: string;
}

interface Props {
  reactions: ReactionItem[];
  currentUserId?: string;
  onToggle?: (type: string) => void;
  align?: 'start' | 'end';
}

interface Group {
  type: string;
  emoji: string;
  label: string;
  count: number;
  mine: boolean;
  names: string[];
}

const reactorId = (user: ReactionItem['user']) =>
  typeof user === 'string' ? user : user?._id;

/** Aggregated reaction chips under a bubble, where pressing your own reaction toggles it off. */
export default function ReactionBar({ reactions, currentUserId, onToggle, align = 'start' }: Props) {
  const [openType, setOpenType] = useState<string | null>(null);

  if (!reactions || reactions.length === 0) return null;

  // Announcements store a name and older chat rows a raw emoji, so both collapse into one chip.
  const groups = new Map<string, Group>();
  for (const r of reactions) {
    const meta = reactionOf(r.emoji);
    if (!meta) continue;
    const group = groups.get(meta.type) || {
      type: meta.type,
      emoji: meta.emoji,
      label: meta.label,
      count: 0,
      mine: false,
      names: [],
    };
    group.count++;
    const uid = reactorId(r.user);
    if (uid && uid === currentUserId) {
      group.mine = true;
      group.names.unshift('You');
    } else if (typeof r.user !== 'string' && r.user?.name) {
      group.names.push(r.user.name);
    }
    groups.set(meta.type, group);
  }

  const items = [...groups.values()].sort(
    (a, b) => REACTIONS.findIndex((r) => r.type === a.type) - REACTIONS.findIndex((r) => r.type === b.type),
  );

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {items.map((group) => (
        <div
          key={group.type}
          className="relative"
          onMouseEnter={() => setOpenType(group.type)}
          onMouseLeave={() => setOpenType(null)}
        >
          <AnimatePresence>
            {openType === group.type && group.names.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 w-max max-w-[14rem] px-2.5 py-1.5 rounded-lg bg-popover border shadow-xl text-[11px] leading-snug text-foreground pointer-events-none"
              >
                <span className="font-semibold">{group.label}</span>
                <span className="block text-muted-foreground">
                  {[
                    ...group.names.slice(0, 8),
                    ...(group.count - Math.min(group.names.length, 8) > 0
                      ? [`${group.count - Math.min(group.names.length, 8)} more`]
                      : []),
                  ].join(', ')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(group.type);
            }}
            onFocus={() => setOpenType(group.type)}
            onBlur={() => setOpenType(null)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] leading-none transition-colors ${
              group.mine
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
            aria-label={`${group.label}, ${group.count} reaction${group.count > 1 ? 's' : ''}: ${group.names.join(', ')}`}
          >
            <span className="text-sm">{group.emoji}</span>
            {group.count > 1 && <span className="font-medium">{group.count}</span>}
          </motion.button>
        </div>
      ))}
    </div>
  );
}
