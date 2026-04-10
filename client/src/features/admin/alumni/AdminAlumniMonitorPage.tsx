import { GraduationCap } from 'lucide-react';
import AdminRoleTagManagerPage from '../shared/AdminRoleTagManagerPage';

export default function AdminAlumniMonitorPage() {
  return (
    <AdminRoleTagManagerPage
      title="Alumni Management"
      description="Members are auto-tagged as Alumni when they add a current job or business. You can also grant Alumni status manually. Revoking only removes the sticky approval — users with current employment remain alumni automatically."
      flagFilter="isAlumni"
      endpoint="alumni"
      icon={GraduationCap}
      iconColor="text-amber-500"
      avatarBg="bg-amber-100 dark:bg-amber-900/30"
      avatarText="text-amber-700 dark:text-amber-400"
      roleLabel="Alumni"
      roleLabelPlural="alumni"
      showAutoTagDistinction
    />
  );
}
