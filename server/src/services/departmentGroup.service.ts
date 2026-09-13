import { Types } from 'mongoose';
import { ChatGroup, SiteSettings, User } from '../models';
import { SUPER_ADMIN_EMAILS, UserRole } from '@rdswa/shared';

interface GroupCandidate {
  _id: Types.ObjectId | string;
  email?: string;
  role?: string;
  department?: string;
  membershipStatus?: string;
  isDeleted?: boolean;
  isActive?: boolean;
}

const CANDIDATE_FIELDS = 'email role department membershipStatus isDeleted isActive';

/** A SuperAdmin sits in every department group, whichever department they study in. */
export function isSuperAdminUser(user: Pick<GroupCandidate, 'email' | 'role'>): boolean {
  return user.role === UserRole.SUPER_ADMIN || (!!user.email && SUPER_ADMIN_EMAILS.includes(user.email));
}

/** The department whose group a user belongs to, or null when they belong to none; rank never widens it. */
export function homeDepartment(user: GroupCandidate): string | null {
  const department = user.department?.trim();
  if (!department) return null;
  if (user.isDeleted || user.isActive === false) return null;
  if (user.membershipStatus !== 'approved') return null;
  return department;
}

/** The departments academicConfig lists, which are the only ones allowed a chat group. */
export async function configuredDepartments(): Promise<Set<string>> {
  const settings = await SiteSettings.findOne().select('academicConfig').lean();
  const set = new Set<string>();
  for (const faculty of (settings as any)?.academicConfig?.faculties || []) {
    for (const dept of faculty?.departments || []) {
      const trimmed = (dept || '').trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return set;
}

/** Who a department group should hold: its own approved students plus every SuperAdmin, who alone administer it. */
export function groupRoster(
  department: string,
  candidates: GroupCandidate[]
): { members: string[]; admins: string[] } {
  const members = new Set<string>();
  const admins = new Set<string>();

  for (const user of candidates) {
    const id = String(user._id);
    if (isSuperAdminUser(user)) {
      if (user.isDeleted || user.isActive === false) continue;
      members.add(id);
      admins.add(id);
    } else if (homeDepartment(user) === department) {
      // A student's rank earns no admin seat here; running the group is left to SuperAdmins.
      members.add(id);
    }
  }

  return { members: [...members], admins: [...admins] };
}

/** Creates the group for a configured department if it is missing, seeded with exactly the people it should hold. */
export async function ensureDepartmentGroup(department: string): Promise<void> {
  const dept = department?.trim();
  if (!dept) return;
  if (!(await configuredDepartments()).has(dept)) return;

  const existing = await ChatGroup.findOne({ type: 'department', department: dept, isDeleted: false })
    .select('_id')
    .lean();
  if (existing) return;

  const candidates = await User.find({ isDeleted: { $ne: true } }).select(CANDIDATE_FIELDS).lean();
  const { members, admins } = groupRoster(dept, candidates as GroupCandidate[]);

  await ChatGroup.create({
    name: `${dept} Group`,
    description: `Group for ${dept} department students`,
    type: 'department',
    department: dept,
    members,
    admins,
  });
}

/** Puts one user in exactly the department group they belong to and takes them out of every other one. */
export async function syncUserDepartmentGroups(userId: string | Types.ObjectId): Promise<void> {
  const user = (await User.findById(userId).select(CANDIDATE_FIELDS).lean()) as GroupCandidate | null;
  if (!user) return;
  const id = user._id;

  if (isSuperAdminUser(user) && !user.isDeleted && user.isActive !== false) {
    await ChatGroup.updateMany(
      { type: 'department', isDeleted: false },
      { $addToSet: { members: id, admins: id } }
    );
    return;
  }

  const home = homeDepartment(user);

  // Leaving every other group first means a department change can never leave someone in two.
  await ChatGroup.updateMany(
    { type: 'department', isDeleted: false, ...(home ? { department: { $ne: home } } : {}) },
    { $pull: { members: id, admins: id } }
  );
  if (!home) return;

  await ensureDepartmentGroup(home);
  await ChatGroup.updateOne(
    { type: 'department', department: home, isDeleted: false },
    { $addToSet: { members: id }, $pull: { admins: id } }
  );
}

/** Rebuilds every department group's roster from the rule, clearing out anyone an earlier version let in. */
export async function reconcileDepartmentGroups(): Promise<number> {
  const [groups, candidates] = await Promise.all([
    ChatGroup.find({ type: 'department', isDeleted: false }).select('_id department members admins').lean(),
    User.find({ isDeleted: { $ne: true } }).select(CANDIDATE_FIELDS).lean(),
  ]);

  let changed = 0;
  for (const group of groups) {
    const { members, admins } = groupRoster((group.department || '').trim(), candidates as GroupCandidate[]);
    const same = (a: unknown[], b: string[]) =>
      a.length === b.length && a.map(String).every((x) => b.includes(x));

    if (same(group.members || [], members) && same(group.admins || [], admins)) continue;

    await ChatGroup.updateOne({ _id: group._id }, { $set: { members, admins } });
    changed++;
  }

  if (changed > 0) {
    console.log(`[departmentGroups] Reconciled ${changed} department group roster(s) to the membership rule`);
  }
  return changed;
}
