import { ThumbsUp } from 'lucide-react';
import { motion } from 'motion/react';

export interface SkillEndorsement {
  skill: string;
  endorsedBy?: { _id?: string; name?: string } | string;
  endorsedAt?: string;
}

interface Props {
  skill: string;
  /** Every endorsement on the profile, filtered to this skill internally. */
  endorsements?: SkillEndorsement[];
  index?: number;
  /** Renders the thumbs-up toggle for a viewer who is allowed to endorse. */
  onToggleEndorse?: () => void;
  hasEndorsed?: boolean;
  disabled?: boolean;
}

/** Skill pill carrying its endorsement count, with the endorsers' names in the tooltip. */
export default function SkillChip({
  skill,
  endorsements = [],
  index = 0,
  onToggleEndorse,
  hasEndorsed = false,
  disabled = false,
}: Props) {
  const mine = endorsements.filter((e) => e.skill === skill);
  const names = mine
    .map((e) => (typeof e.endorsedBy === 'object' ? e.endorsedBy?.name : undefined))
    .filter(Boolean) as string[];

  const countLabel = names.length
    ? `Endorsed by ${names.join(', ')}`
    : `${mine.length} endorsement${mine.length === 1 ? '' : 's'}`;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 + index * 0.03 }}
      className={`inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2 text-xs ${mine.length > 0 || onToggleEndorse ? 'pr-1' : 'pr-2'}`}
    >
      {skill}

      {mine.length > 0 && (
        <span
          title={countLabel}
          aria-label={countLabel}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
        >
          <ThumbsUp className="h-2.5 w-2.5 fill-current" />
          {mine.length}
        </span>
      )}

      {onToggleEndorse && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleEndorse}
          disabled={disabled}
          title={hasEndorsed ? 'Remove endorsement' : 'Endorse this skill'}
          aria-label={hasEndorsed ? `Remove your endorsement of ${skill}` : `Endorse ${skill}`}
          className={`rounded p-0.5 transition-colors disabled:opacity-50 ${hasEndorsed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
        >
          <ThumbsUp className={`h-3 w-3 ${hasEndorsed ? 'fill-primary' : ''}`} />
        </motion.button>
      )}
    </motion.span>
  );
}
