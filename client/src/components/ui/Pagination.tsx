import { useState } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Tailwind sizing of buttons. "sm" matches admin tables, "md" matches public list pages. */
  size?: "sm" | "md";
  className?: string;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  size = "sm",
  className = "",
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");

  const submitJump = () => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(n, 1), totalPages);
    onChange(clamped);
    setJumpValue("");
  };

  const btn =
    size === "md"
      ? "px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-accent"
      : "px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent";
  const label =
    size === "md"
      ? "px-4 py-2 text-sm text-muted-foreground"
      : "px-3 py-1 text-sm text-muted-foreground";

  return (
    <div
      className={`flex flex-wrap justify-center items-center gap-2 mt-4 ${className}`}
    >
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={btn}
      >
        Prev
      </button>
      <span className={label}>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={btn}
      >
        Next
      </button>
      <div className="flex items-center gap-1 ml-2">
        <span className="text-xs text-muted-foreground">Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitJump();
          }}
          placeholder={String(page)}
          className="w-16 px-2 py-1 border rounded text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button onClick={submitJump} disabled={!jumpValue} className={btn}>
          Go
        </button>
      </div>
    </div>
  );
}
