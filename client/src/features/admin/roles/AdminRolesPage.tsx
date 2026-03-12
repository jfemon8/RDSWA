import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { Shield, Check, X } from 'lucide-react';
import { UserRole, ROLE_HIERARCHY, PERMISSIONS, Module, Action } from '@rdswa/shared';

const ROLE_COLORS: Record<string, string> = {
  guest: 'bg-muted text-muted-foreground',
  user: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  member: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  alumni: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  advisor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  senior_advisor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  moderator: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  guest: 'Unauthenticated visitors with read-only public access',
  user: 'Registered users who haven\'t been approved as members',
  member: 'Approved RDSWA members with full platform access',
  alumni: 'Graduated members with continued access',
  advisor: 'Faculty or senior advisors with advisory privileges',
  senior_advisor: 'Senior advisors with elevated advisory access',
  moderator: 'Committee officers with content management rights',
  admin: 'Platform administrators with full management access',
  super_admin: 'System owner with unrestricted access',
};

const modules = Object.values(Module);
const actions = Object.values(Action);
const displayRoles = ROLE_HIERARCHY.filter(r => r !== UserRole.GUEST);

export default function AdminRolesPage() {
  return (
    <div className="space-y-8 p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Role Management</h1>

      {/* Role Hierarchy */}
      <FadeIn direction="up" delay={0.1}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg text-foreground">Role Hierarchy</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Roles are ordered by privilege level. Higher roles inherit all permissions of lower roles.
          </p>
          <div className="flex flex-wrap gap-3">
            {ROLE_HIERARCHY.map((role, i) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                className="flex items-center gap-2"
              >
                <div className={`px-3 py-2 rounded-lg text-sm font-medium capitalize ${ROLE_COLORS[role]}`}>
                  {role.replace('_', ' ')}
                </div>
                {i < ROLE_HIERARCHY.length - 1 && (
                  <span className="text-muted-foreground text-lg">→</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Role Details */}
      <FadeIn direction="up" delay={0.2}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h2 className="font-semibold text-lg mb-4 text-foreground">Role Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_HIERARCHY.map((role, i) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="border rounded-lg p-4"
              >
                <div className={`inline-block px-2.5 py-1 rounded text-xs font-semibold capitalize mb-2 ${ROLE_COLORS[role]}`}>
                  {role.replace('_', ' ')}
                </div>
                <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                <div className="mt-3 text-xs text-muted-foreground">
                  Level {ROLE_HIERARCHY.indexOf(role) + 1} of {ROLE_HIERARCHY.length}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Permission Matrix */}
      <FadeIn direction="up" delay={0.3}>
        <div className="border rounded-lg p-4 sm:p-5 bg-card">
          <h2 className="font-semibold text-lg mb-4 text-foreground">Permission Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-2 font-medium text-foreground sticky left-0 bg-muted z-10 min-w-[140px]">Module : Action</th>
                  {displayRoles.map((role) => (
                    <th key={role} className="p-2 font-medium text-center capitalize whitespace-nowrap text-foreground">
                      {role.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => {
                  const modActions = actions.filter((a) => PERMISSIONS[`${mod}:${a}`]);
                  if (modActions.length === 0) return null;
                  return modActions.map((action, ai) => {
                    const key = `${mod}:${action}`;
                    const allowedRoles = PERMISSIONS[key] || [];
                    return (
                      <tr key={key} className={`border-b ${ai === 0 ? 'border-t-2 border-t-muted' : ''}`}>
                        <td className="p-2 sticky left-0 bg-card z-10">
                          <span className="font-medium text-foreground">{mod}</span>
                          <span className="text-muted-foreground"> : {action}</span>
                        </td>
                        {displayRoles.map((role) => (
                          <td key={role} className="p-2 text-center">
                            {allowedRoles.includes(role) ? (
                              <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
