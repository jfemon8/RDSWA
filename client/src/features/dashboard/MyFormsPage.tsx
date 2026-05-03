import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { FileText, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';

import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600', label: 'Pending' },
  under_review: { icon: Clock, color: 'text-blue-600', label: 'Under Review' },
  approved: { icon: CheckCircle, color: 'text-green-600', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-600', label: 'Rejected' },
};

export default function MyFormsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['forms', 'my'],
    queryFn: async () => {
      const { data } = await api.get('/forms/my');
      return data;
    },
  });

  const forms = data?.data || [];

  if (isLoading) {
    return <Spinner size="md" />;
  }

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Submissions</h1>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
          <Link
            to="/dashboard/forms/new"
            className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" /> New Submission
          </Link>
        </motion.div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No form submissions yet</p>
          <Link to="/dashboard/forms/new" className="text-primary text-sm hover:underline mt-2 inline-block">
            Submit your first form
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((f: any, i: number) => {
            const status = statusConfig[f.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <FadeIn key={f._id} delay={i * 0.06} direction="up" distance={15}>
                <div className="p-4 border rounded-lg bg-background">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize flex items-center gap-1.5 break-words">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="break-words">{f.type.replace('_', ' ')} Form</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Submitted {formatDate(f.createdAt)}
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-1 text-sm font-medium self-start sm:self-auto whitespace-nowrap shrink-0 ${status.color}`}>
                      <StatusIcon className="h-4 w-4 shrink-0" />
                      {status.label}
                    </div>
                  </div>
                  {f.reviewComment && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded break-words">{f.reviewComment}</p>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>
      )}
    </div>
  );
}
