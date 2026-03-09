import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Users, Calendar, DollarSign, FileText, Clock, UserCheck, Loader2 } from 'lucide-react';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const stats = data?.data;

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-600' },
    { label: 'Approved Members', value: stats?.approvedMembers || 0, icon: UserCheck, color: 'text-green-600' },
    { label: 'Pending Members', value: stats?.pendingMembers || 0, icon: Clock, color: 'text-yellow-600' },
    { label: 'Total Events', value: stats?.totalEvents || 0, icon: Calendar, color: 'text-purple-600' },
    { label: 'Total Donations', value: `৳${(stats?.totalDonationsAmount || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Pending Forms', value: stats?.pendingForms || 0, icon: FileText, color: 'text-orange-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="border rounded-lg p-5 bg-background">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
