import { GraduationCap } from "lucide-react";
import AdminRoleTagManagerPage from "../shared/AdminRoleTagManagerPage";

export default function AdminAlumniMonitorPage() {
  return (
    <AdminRoleTagManagerPage
      title="Alumni Management"
      description="User who has been manually revoked will NOT be re-tagged automatically even if they have current employment, until an admin grants again."
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
