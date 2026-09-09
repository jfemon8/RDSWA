import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { divisions, districts, type Division } from '@/data/bdGeo';

interface DistrictPickerProps {
  value: string;
  onChange: (district: string) => void;
  className?: string;
  /** Padding for the trigger, so it can match filter rows that size their inputs differently. */
  triggerClassName?: string;
}

/** District chooser that opens on its divisions first, since sixty-four flat options are hard to scan. */
export default function DistrictPicker({
  value,
  onChange,
  className = '',
  triggerClassName = 'px-3 py-2.5',
}: DistrictPickerProps) {
  const [open, setOpen] = useState(false);
  const [openDivision, setOpenDivision] = useState<Division | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reopening lands on the division holding the current pick, rather than a collapsed list.
  useEffect(() => {
    if (!open) return;
    const owner = divisions.find((d) => districts[d]?.includes(value));
    setOpenDivision(owner ?? null);
  }, [open, value]);

  const select = (district: string) => {
    onChange(district);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        // h-full lets a stretching filter row set the height, and the padding stands in when the row stacks.
        className={`w-full h-full flex items-center gap-2 border rounded-md bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/50 ${triggerClassName}`}
      >
        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className={`flex-1 truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value || 'All Districts'}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear district"
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 mt-1 w-full min-w-[15rem] max-h-80 overflow-y-auto rounded-md border bg-popover shadow-xl"
          >
            <button
              type="button"
              onClick={() => select('')}
              className={`w-full text-left px-3 py-2 text-sm border-b hover:bg-accent ${!value ? 'text-primary font-medium' : ''}`}
            >
              All Districts
            </button>

            {divisions.map((division) => {
              const isOpen = openDivision === division;
              return (
                <div key={division} className="border-b last:border-0">
                  <button
                    type="button"
                    // One division at a time, so the panel never turns back into a long flat list.
                    onClick={() => setOpenDivision(isOpen ? null : division)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{division}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="districts"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden bg-muted/30"
                      >
                        {(districts[division] || []).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => select(d)}
                            className={`w-full text-left pl-7 pr-3 py-1.5 text-sm hover:bg-accent ${
                              value === d ? 'text-primary font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
