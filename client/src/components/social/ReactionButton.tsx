import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThumbsUp } from 'lucide-react';
import { REACTIONS, reactionOf, type ReactionSummary } from './reactions';

interface ReactionButtonProps {
  summary: ReactionSummary;
  onReact: (type: string | null) => void;
  disabled?: boolean;
  /** The compact form used under a comment, where the trigger is a plain text link. */
  compact?: boolean;
}

/**
 * Trigger for the reaction picker: hovering opens the row of choices, a plain press applies Like,
 * and pressing again with a reaction already set removes it.
 */
export default function ReactionButton({ summary, onReact, disabled, compact }: ReactionButtonProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const longPress = useRef<number | null>(null);
  const mine = reactionOf(summary.mine);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    if (longPress.current) window.clearTimeout(longPress.current);
  }, []);

  // A small delay on leaving keeps the picker reachable while the pointer crosses the gap.
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 220);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const apply = (type: string) => {
    setOpen(false);
    onReact(summary.mine === type ? null : type);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute bottom-full left-0 mb-2 flex items-center gap-1 px-2 py-1.5 rounded-full border bg-popover shadow-xl z-30"
          >
            {REACTIONS.map((r) => (
              <motion.button
                key={r.type}
                type="button"
                onClick={() => apply(r.type)}
                whileHover={{ scale: 1.35, y: -4 }}
                whileTap={{ scale: 1.1 }}
                title={r.label}
                aria-label={r.label}
                className="text-xl leading-none px-0.5"
              >
                {r.emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        disabled={disabled}
        onClick={() => apply(summary.mine || 'like')}
        // Touch has no hover, so holding the trigger opens the picker instead.
        onTouchStart={() => { longPress.current = window.setTimeout(() => setOpen(true), 350); }}
        onTouchEnd={() => { if (longPress.current) window.clearTimeout(longPress.current); }}
        className={
          compact
            ? `text-xs font-semibold transition-colors disabled:opacity-50 ${mine ? mine.color : 'text-muted-foreground hover:text-foreground'}`
            : `flex items-center justify-center gap-2 px-5 py-2 rounded-full border text-sm font-medium transition-colors disabled:opacity-50 hover:bg-accent ${mine ? `${mine.color} border-current/30` : 'text-muted-foreground'}`
        }
      >
        {compact ? (
          mine?.label || 'Like'
        ) : (
          <>
            {mine ? <span className="text-base leading-none">{mine.emoji}</span> : <ThumbsUp className="h-4 w-4" />}
            {mine?.label || 'Like'}
          </>
        )}
      </button>
    </div>
  );
}
