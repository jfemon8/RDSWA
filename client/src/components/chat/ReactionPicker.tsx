import { motion } from "motion/react";

/** Fixed set: must match server's ALLOWED_REACTIONS. */
export const REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "🎉",
] as const;

interface Props {
  onPick: (emoji: string) => void;
  align?: "start" | "end";
  selectedEmoji?: string | null;
}

/** Compact emoji picker shown above a message on hover or context menu. */
export default function ReactionPicker({
  onPick,
  align = "start",
  selectedEmoji,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={`flex items-center gap-1 px-2 py-1.5 bg-card border rounded-full shadow-lg ${align === "end" ? "self-end" : "self-start"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {REACTIONS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          whileHover={{ scale: 1.25, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPick(emoji)}
          className={`h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent text-lg ${selectedEmoji === emoji ? "bg-primary/15 ring-2 ring-primary/50" : ""}`}
          aria-label={`React with ${emoji}`}
          aria-pressed={selectedEmoji === emoji}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}
