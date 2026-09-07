import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, FileText, ExternalLink } from 'lucide-react';
import DocumentUploadField from '@/components/ui/DocumentUploadField';
import { FieldError } from '@/components/ui/FieldError';
import { proxyFileUrl } from '@/lib/fileProxy';

export interface ExpenseItem {
  head: string;
  amount: string;
  note?: string;
}

export interface ExpenseAttachment {
  name: string;
  url: string;
  type?: string;
}

export const MAX_EXPENSE_ITEMS = 50;
export const MAX_EXPENSE_ATTACHMENTS = 20;

/** Sum of the costs that carry a usable amount, which is what the server will store as the expense total. */
export function itemsTotal(items: ExpenseItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

const money = (n: number) => `BDT ${n.toLocaleString()}`;

interface Props {
  items: ExpenseItem[];
  attachments: ExpenseAttachment[];
  onItemsChange: (items: ExpenseItem[]) => void;
  onAttachmentsChange: (attachments: ExpenseAttachment[]) => void;
  onError?: (message: string) => void;
  error?: string;
  className?: string;
}

/** Optional list of what an expense was spent on, plus the documents that prove it. */
export default function ExpenseDetailsFields({
  items,
  attachments,
  onItemsChange,
  onAttachmentsChange,
  onError,
  error,
  className = '',
}: Props) {
  const field =
    'px-2.5 py-1.5 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

  const patchItem = (index: number, patch: Partial<ExpenseItem>) =>
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className={`border rounded-lg p-3 bg-muted/30 space-y-3 ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-medium text-muted-foreground">Spending Details</p>
          {items.length > 0 && (
            <p className="text-xs font-medium text-foreground tabular-nums">
              Total {money(itemsTotal(items))}
            </p>
          )}
        </div>

        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 mb-2"
            >
              <input
                placeholder="Spent on (e.g. Banner printing)"
                value={item.head}
                onChange={(e) => patchItem(i, { head: e.target.value })}
                className={`${field} flex-[2] min-w-0`}
              />
              <input
                type="number"
                min="1"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => patchItem(i, { amount: e.target.value })}
                className={`${field} w-28 shrink-0`}
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onItemsChange(items.filter((_, j) => j !== i))}
                title="Remove cost"
                aria-label="Remove cost"
                className="p-1.5 text-muted-foreground hover:text-red-500 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>

        <FieldError message={error} />

        {items.length < MAX_EXPENSE_ITEMS && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onItemsChange([...items, { head: '', amount: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-accent text-foreground"
          >
            <Plus className="h-3 w-3" /> Add Cost
          </motion.button>
        )}

        {items.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            The expense amount is taken from these costs.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Proof documents ({attachments.length})
        </p>

        {attachments.length > 0 && (
          <div className="space-y-1 mb-2">
            {attachments.map((a, i) => (
              <motion.div
                key={`${a.url}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-card border rounded-md text-xs"
              >
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="flex-1 min-w-0 truncate text-foreground" title={a.name}>
                  {a.name}
                </span>
                <a
                  href={proxyFileUrl(a.url, a.name)}
                  target="_blank"
                  rel="noreferrer"
                  title="Open document"
                  className="p-0.5 text-primary hover:bg-primary/10 rounded shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onAttachmentsChange(attachments.filter((_, j) => j !== i))}
                  title="Remove document"
                  aria-label="Remove document"
                  className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}

        {attachments.length < MAX_EXPENSE_ATTACHMENTS && (
          <DocumentUploadField
            value=""
            onUploaded={(url, originalName) =>
              onAttachmentsChange([...attachments, { name: originalName, url }])
            }
            onClear={() => undefined}
            onError={onError}
          />
        )}
      </div>
    </div>
  );
}
