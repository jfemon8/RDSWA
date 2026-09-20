import { motion } from "motion/react";
import { REACTIONS } from "@/components/social/reactions";

interface Props {
  /** Receives the reaction's canonical name, the same one announcements store. */
  onPick: (type: string) => void;
  align?: "start" | "end";
  selectedType?: string | null;
}

/** Compact reaction picker shown above a message on hover or context menu. */
export default function ReactionPicker({
  onPick,
  align = "start",
  selectedType,
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
      {REACTIONS.map((reaction) => (
        <motion.button
          key={reaction.type}
          type="button"
          whileHover={{ scale: 1.25, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPick(reaction.type)}
          className={`h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent text-lg ${selectedType === reaction.type ? "bg-primary/15 ring-2 ring-primary/50" : ""}`}
          aria-label={`React with ${reaction.label}`}
          title={reaction.label}
          aria-pressed={selectedType === reaction.type}
        >
          {reaction.emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}
