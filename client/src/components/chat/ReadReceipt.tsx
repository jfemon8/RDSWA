import { Check, CheckCheck, Clock } from 'lucide-react';

interface Props {
  /** True once the message has been created server-side (has an _id). */
  sent: boolean;
  /** True when at least one non-sender recipient has read it. */
  read: boolean;
  /** Optional: tweak color to fit bubble theme */
  className?: string;
}

/**
 * Single-tick for sent, double-tick grey for delivered, double-tick blue for read.
 * Falls back to a clock for optimistic messages without an id.
 */
export default function ReadReceipt({ sent, read, className }: Props) {
  if (!sent) return <Clock className={`h-3 w-3 ${className || ''}`} />;
  if (read) return <CheckCheck className={`h-3 w-3 text-sky-300 ${className || ''}`} />;
  return <Check className={`h-3 w-3 ${className || ''}`} />;
}
