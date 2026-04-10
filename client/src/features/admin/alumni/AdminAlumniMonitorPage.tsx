import { GraduationCap } from 'lucide-react';
import AdminRoleTagManagerPage from '../shared/AdminRoleTagManagerPage';

export default function AdminAlumniMonitorPage() {
  return (
    <AdminRoleTagManagerPage
      title="Alumni Management"
      description="Members are auto-tagged as Alumni when they add a current job or business. You can also grant Alumni status manually, or revoke it. Revoking is sticky — a user who has been manually revoked will NOT be re-tagged automatically even if they have current employment, until an admin grants again."
      flagFilter="isAlumni"
      endpoint="alumni"
      icon={GraduationCap}
      iconColor="text-amber-500"
      avatarBg="bg-amber-100 dark:bg-amber-900/30"
      avatarText="text-amber-700 dark:text-amber-400"
      roleLabel="Alumni"
      roleLabelPlural="alumni"
      showEmploymentInfo
    />
  );
}
