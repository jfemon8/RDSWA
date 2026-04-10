import { motion } from 'motion/react';

interface Props {
  /** Display labels of currently typing users (empty = hide). */
  names: string[];
}

/** Animated three-dot bubble shown at the bottom of the message list. */
export default function TypingIndicator({ names }: Props) {
  if (names.length === 0) return null;

  let label = '';
  if (names.length === 1) label = `${names[0]} is typing`;
  else if (names.length === 2) label = `${names[0]} and ${names[1]} are typing`;
  else label = `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length > 3 ? 's' : ''} are typing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-center gap-2 px-3 py-2"
    >
      <div className="flex items-center gap-1 px-3 py-2 bg-muted rounded-2xl rounded-bl-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground italic">{label}</span>
    </motion.div>
  );
}
