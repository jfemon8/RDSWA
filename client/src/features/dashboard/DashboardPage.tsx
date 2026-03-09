import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bell, FileText, Calendar, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=5');
      return data;
    },
  });

  const unreadCount = notifications?.data?.filter((n: any) => !n.isRead).length || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Welcome, {user?.name}
      </h1>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard
          icon={<Users className="h-5 w-5" />}
          label="Membership"
          value={user?.membershipStatus === 'approved' ? 'Active' : user?.membershipStatus || 'None'}
          color={user?.membershipStatus === 'approved' ? 'text-green-600' : 'text-yellow-600'}
        />
        <StatusCard
          icon={<Bell className="h-5 w-5" />}
          label="Notifications"
          value={`${unreadCount} unread`}
          color="text-blue-600"
        />
        <StatusCard
          icon={<FileText className="h-5 w-5" />}
          label="Role"
          value={user?.role?.replace('_', ' ') || 'User'}
          color="text-purple-600"
        />
        <StatusCard
          icon={<Calendar className="h-5 w-5" />}
          label="Email"
          value={user?.isEmailVerified ? 'Verified' : 'Not Verified'}
          color={user?.isEmailVerified ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction to="/dashboard/profile" label="Edit Profile" description="Update your personal information" />
        <QuickAction to="/dashboard/notifications" label="View Notifications" description="Check recent notifications" />
        <QuickAction to="/events" label="Browse Events" description="See upcoming events" />
        <QuickAction to="/notices" label="Read Notices" description="Latest announcements" />
        {user?.membershipStatus === 'none' && (
          <QuickAction to="/dashboard/forms" label="Apply for Membership" description="Submit your membership application" />
        )}
        <QuickAction to="/donations" label="Make Donation" description="Support RDSWA activities" />
      </div>

      {/* Recent notifications */}
      {notifications?.data && notifications.data.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
          <div className="space-y-2">
            {notifications.data.slice(0, 5).map((n: any) => (
              <div key={n._id} className={`p-3 rounded-md border text-sm ${n.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}>
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-background border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className={`text-lg font-semibold capitalize ${color}`}>{value}</p>
    </div>
  );
}

function QuickAction({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link to={to} className="block p-4 border rounded-lg hover:bg-accent transition-colors">
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
