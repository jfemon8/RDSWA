import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Link } from 'react-router-dom';
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
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">My Submissions</h1>
        <Link
          to="/dashboard/forms/new"
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Submission
        </Link>
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
                <div
                  className="p-4 border rounded-lg bg-background"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary shrink-0" /> {f.type.replace('_', ' ')} Form
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Submitted {formatDate(f.createdAt)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${status.color}`}>
                      <StatusIcon className="h-4 w-4" />
                      {status.label}
                    </div>
                  </div>
                  {f.reviewComment && (
                    <p className="text-sm mt-2 p-2 bg-muted rounded">{f.reviewComment}</p>
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
