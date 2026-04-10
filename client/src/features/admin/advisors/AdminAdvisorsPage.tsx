import { Award } from 'lucide-react';
import AdminRoleTagManagerPage from '../shared/AdminRoleTagManagerPage';

export default function AdminAdvisorsPage() {
  return (
    <AdminRoleTagManagerPage
      title="Advisors Management"
      description="Ex-presidents and ex-general secretaries are automatically granted the Advisor tag when their committee is archived. You can also add or remove Advisors manually here. Revoking does not affect membership."
      flagFilter="isAdvisor"
      endpoint="advisor"
      icon={Award}
      iconColor="text-cyan-600"
      avatarBg="bg-cyan-100 dark:bg-cyan-900/30"
      avatarText="text-cyan-700 dark:text-cyan-400"
      roleLabel="Advisor"
      roleLabelPlural="advisors"
    />
  );
}
