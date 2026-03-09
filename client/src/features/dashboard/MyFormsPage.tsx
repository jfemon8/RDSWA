import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Link } from 'react-router-dom';
import { FileText, Loader2, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';

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
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Submissions</h1>
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
          {forms.map((f: any) => {
            const status = statusConfig[f.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={f._id} className="p-4 border rounded-lg bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{f.type.replace('_', ' ')} Form</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Submitted {new Date(f.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
