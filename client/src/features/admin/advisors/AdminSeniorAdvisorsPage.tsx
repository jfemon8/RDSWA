import { Star } from "lucide-react";
import AdminRoleTagManagerPage from "../shared/AdminRoleTagManagerPage";

export default function AdminSeniorAdvisorsPage() {
  return (
    <AdminRoleTagManagerPage
      title="Senior Advisors Management"
      description="Senior Advisors are appointed manually by administrators."
      flagFilter="isSeniorAdvisor"
      endpoint="senior-advisor"
      icon={Star}
      iconColor="text-indigo-600"
      avatarBg="bg-indigo-100 dark:bg-indigo-900/30"
      avatarText="text-indigo-700 dark:text-indigo-400"
      roleLabel="Senior Advisor"
      roleLabelPlural="senior advisors"
      allowAnyUser
    />
  );
}
