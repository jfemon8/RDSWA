import { motion } from "motion/react";
import { CalendarClock, Lock } from "lucide-react";
import { toDateInput } from "@/lib/date";
import {
  attendanceWindowClosedMessage,
  type AttendanceWindow,
} from "@rdswa/shared";

interface AttendanceDateFieldProps {
  /** Window for the acting user, from `getAttendanceWindow`. */
  attendanceWindow: AttendanceWindow;
  event: { startDate: string | Date };
  /** `YYYY-MM-DD`, or '' for "use today". */
  value: string;
  onChange: (value: string) => void;
  id: string;
  className?: string;
}

/**
 * Optional backdate picker, shown only once an event has ended.
 *
 * Bounds mirror the server rules in `resolveCheckedInAt`.
 */
export default function AttendanceDateField({
  attendanceWindow,
  event,
  value,
  onChange,
  id,
  className = "",
}: AttendanceDateFieldProps) {
  if (!attendanceWindow.allowsBackdate || !attendanceWindow.isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mb-2 ${className}`}
    >
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1"
      >
        <CalendarClock className="h-3.5 w-3.5 text-primary" />
        Attendance date
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={toDateInput(event.startDate)}
        max={toDateInput(new Date())}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </motion.div>
  );
}

/** Replaces the entry controls once the deadline has passed, so the reason is visible. */
export function AttendanceWindowClosedNotice({
  attendanceWindow,
  className = "",
}: {
  attendanceWindow: AttendanceWindow;
  className?: string;
}) {
  if (attendanceWindow.isOpen) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300 ${className}`}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{attendanceWindowClosedMessage(attendanceWindow)}</span>
    </div>
  );
}
