import { ChatGroup, User, SiteSettings } from '../models';
import { UserRole } from '@rdswa/shared';

/** Read the canonical department list from academicConfig, the single source of truth for which departments may have a chat group. */
async function getConfiguredDepartments(): Promise<Set<string>> {
  const settings = await SiteSettings.findOne();
  const faculties = settings?.academicConfig?.faculties || [];
  const set = new Set<string>();
  for (const f of faculties) {
    for (const d of f?.departments || []) {
      const trimmed = (d || '').trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return set;
}

/** Reconcile department chat groups against academicConfig, creating, soft-deleting, or re-activating them as the list changes. */
export async function syncDepartmentGroups(): Promise<void> {
  const configured = await getConfiguredDepartments();

  const adminUsers = await User.find({
    isDeleted: false, isActive: true,
    role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  }).select('_id').lean();
  const adminIds = adminUsers.map((u) => u._id);

  // 1. Ensure a group exists for every configured department.
  for (const dept of configured) {
    const existing = await ChatGroup.findOne({ type: 'department', department: dept });
    if (!existing) {
      const deptMembers = await User.find({
        isDeleted: false, department: dept, membershipStatus: 'approved',
      }).select('_id').lean();
      const deptMemberIds = deptMembers.map((u) => u._id);
      const allDeptIds = [...new Set([...deptMemberIds.map(String), ...adminIds.map(String)])];

      await ChatGroup.create({
        name: `${dept} Group`,
        description: `Group for ${dept} department students`,
        type: 'department',
        department: dept,
        members: allDeptIds,
        admins: adminIds,
      });
      console.log(`Department group created: ${dept}`);
    } else {
      // Reactivate if previously soft-deleted, and ensure admins are present.
      const update: any = {
        $addToSet: { members: { $each: adminIds }, admins: { $each: adminIds } },
      };
      if (existing.isDeleted) update.$set = { isDeleted: false };
      await ChatGroup.findByIdAndUpdate(existing._id, update);
      if (existing.isDeleted) console.log(`Department group reactivated: ${dept}`);
    }
  }

  // 2. Soft-delete department groups that are no longer in the configured list.
  const orphans = await ChatGroup.find({
    type: 'department',
    isDeleted: false,
    department: { $nin: Array.from(configured) },
  }).select('_id department').lean();

  if (orphans.length > 0) {
    await ChatGroup.updateMany(
      { _id: { $in: orphans.map((g) => g._id) } },
      { $set: { isDeleted: true } }
    );
    for (const o of orphans) console.log(`Department group archived (off-list): ${o.department}`);
  }
}

/** Ensure the central and department groups exist, run once at startup. */
export async function initializeGroups(): Promise<void> {
  try {
    // Fetch all admin/superadmin users for auto-adding
    const adminUsers = await User.find({
      isDeleted: false, isActive: true,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).select('_id').lean();
    const adminIds = adminUsers.map((u) => u._id);

    // 1. Ensure central group exists
    let centralGroup = await ChatGroup.findOne({ type: 'central', isDeleted: false });
    if (!centralGroup) {
      const allMembers = await User.find({
        isDeleted: false, isActive: true,
        membershipStatus: 'approved',
      }).select('_id').lean();
      const memberIds = allMembers.map((u) => u._id);
      // Merge admin IDs into members
      const allIds = [...new Set([...memberIds.map(String), ...adminIds.map(String)])];

      centralGroup = await ChatGroup.create({
        name: 'RDSWA, BU',
        description: 'Central group for all RDSWA members',
        type: 'central',
        members: allIds,
        admins: adminIds,
      });
      console.log('Central group created');
    } else {
      // Ensure admins are in the central group
      await ChatGroup.findByIdAndUpdate(centralGroup._id, {
        $addToSet: { members: { $each: adminIds }, admins: { $each: adminIds } },
      });
    }

    // 2. Sync department groups against the configured academic faculties list.
    await syncDepartmentGroups();
  } catch (err) {
    console.error('Group initializer error:', err);
  }
}

/** Ensure the central "RDSWA, BU" group exists, seeding it with every approved member and admin when first created. */
export async function ensureCentralGroup(): Promise<void> {
  const existing = await ChatGroup.findOne({ type: 'central', isDeleted: false });
  if (existing) return;

  const [approvedMembers, adminUsers] = await Promise.all([
    User.find({
      isDeleted: false, isActive: true,
      membershipStatus: 'approved',
    }).select('_id').lean(),
    User.find({
      isDeleted: false, isActive: true,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).select('_id').lean(),
  ]);

  const adminIds = adminUsers.map((u) => u._id);
  const memberIds = [
    ...new Set([...approvedMembers.map((u) => u._id.toString()), ...adminIds.map(String)]),
  ];

  await ChatGroup.create({
    name: 'RDSWA, BU',
    description: 'Central group for all RDSWA members',
    type: 'central',
    members: memberIds,
    admins: adminIds,
  });
}

/** Ensure a group exists for a department listed in academicConfig, seeding it with that department's approved members and all admins. */
export async function ensureDepartmentGroup(department: string): Promise<void> {
  if (!department) return;
  const configured = await getConfiguredDepartments();
  if (!configured.has(department.trim())) return;

  const existing = await ChatGroup.findOne({ type: 'department', department, isDeleted: false });
  if (existing) return;

  const [deptMembers, adminUsers] = await Promise.all([
    User.find({
      isDeleted: false, isActive: true,
      department,
      membershipStatus: 'approved',
    }).select('_id').lean(),
    User.find({
      isDeleted: false, isActive: true,
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).select('_id').lean(),
  ]);

  const adminIds = adminUsers.map((u) => u._id);
  const memberIds = [
    ...new Set([...deptMembers.map((u) => u._id.toString()), ...adminIds.map(String)]),
  ];

  await ChatGroup.create({
    name: `${department} Group`,
    description: `Group for ${department} department students`,
    type: 'department',
    department,
    members: memberIds,
    admins: adminIds,
  });
}
