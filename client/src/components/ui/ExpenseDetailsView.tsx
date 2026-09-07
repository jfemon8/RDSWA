import { FileText, ExternalLink } from 'lucide-react';
import { proxyFileUrl } from '@/lib/fileProxy';

interface Props {
  items?: Array<{ head: string; amount: number; note?: string }>;
  attachments?: Array<{ name: string; url: string; type?: string }>;
  className?: string;
}

const money = (n: number) => `BDT ${(n || 0).toLocaleString()}`;

/** Read-only spending details and proof documents of one expense, rendering nothing when it has neither. */
export default function ExpenseDetailsView({ items = [], attachments = [], className = '' }: Props) {
  if (items.length === 0 && attachments.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Spending Details</p>
          <div className="space-y-1">
            {items.map((item, i) => (
              <div key={i} className="flex items-baseline gap-2 text-xs">
                <span className="text-foreground truncate">{item.head}</span>
                <span className="flex-1 border-b border-dotted border-muted-foreground/30" />
                <span className="font-medium text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums">
                  {money(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-baseline gap-2 text-xs pt-1 border-t">
              <span className="font-medium text-foreground">Total</span>
              <span className="flex-1" />
              <span className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums">
                {money(items.reduce((sum, item) => sum + (item.amount || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Proof documents ({attachments.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <a
                key={`${a.url}-${i}`}
                href={proxyFileUrl(a.url, a.name)}
                target="_blank"
                rel="noreferrer"
                title={a.name}
                className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 border rounded-md bg-card text-xs text-foreground hover:bg-accent"
              >
                <FileText className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{a.name}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
