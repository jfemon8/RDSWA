import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import api from '@/lib/api';

interface EventFinanceSummaryProps {
  eventId: string;
  /** Compact drops the heading, for places that already have one. */
  compact?: boolean;
  className?: string;
}

const money = (n: number) => `BDT ${(n || 0).toLocaleString()}`;

/** Budget, income and expense for one event, rendering nothing until something is actually linked. */
export default function EventFinanceSummary({
  eventId,
  compact = false,
  className = '',
}: EventFinanceSummaryProps) {
  const { data } = useQuery({
    queryKey: ['event-finance', eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/finance`)).data,
    enabled: !!eventId,
  });

  const finance = data?.data;
  if (!finance?.hasData) return null;

  const cells = [
    { label: 'Budget', value: finance.budget, icon: Wallet, tone: 'text-foreground', show: finance.counts.budget > 0 },
    { label: 'Income', value: finance.income, icon: TrendingUp, tone: 'text-green-600 dark:text-green-400', show: finance.counts.income > 0 },
    { label: 'Expense', value: finance.expense, icon: TrendingDown, tone: 'text-red-600 dark:text-red-400', show: finance.counts.expense > 0 },
  ].filter((c) => c.show);

  const showNet = finance.counts.income > 0 && finance.counts.expense > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-4 bg-card ${className}`}
    >
      {!compact && (
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
          <Scale className="h-4 w-4 text-primary" /> Event Finance
        </h3>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {cells.map(({ label, value, icon: Icon, tone }) => (
          <div key={label}>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {label}
            </span>
            <p className={`font-semibold ${tone}`}>{money(value)}</p>
          </div>
        ))}

        {showNet && (
          <div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> Net
            </span>
            <p
              className={`font-semibold ${
                finance.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}
            >
              {finance.net < 0 ? '−' : '+'} {money(Math.abs(finance.net))}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
