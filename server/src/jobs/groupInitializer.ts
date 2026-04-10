import { ChatGroup, User } from '../models';
import { UserRole } from '@rdswa/shared';

/**
 * Ensure central group and department groups exist.
 * Run once at startup.
 */
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

    // 2. Ensure department groups exist for all departments with members
    const departments: string[] = await User.distinct('department', {
      isDeleted: false,
      department: { $nin: [null, ''] },
    });

    for (const dept of departments) {
      if (!dept) continue;
      const existing = await ChatGroup.findOne({ type: 'department', department: dept, isDeleted: false });
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
        // Ensure admins are members+admins
        await ChatGroup.findByIdAndUpdate(existing._id, {
          $addToSet: { members: { $each: adminIds }, admins: { $each: adminIds } },
        });
      }
    }
  } catch (err) {
    console.error('Group initializer error:', err);
  }
}

/**
 * Ensure the central "RDSWA, BU" group exists. Creates it if missing.
 * On creation: seeds with all existing approved members + all admins.
 */
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

/**
 * Ensure a department group exists. Called when a user's department is set.
 * On creation: seeds with all existing approved members of that department + all admins.
 */
export async function ensureDepartmentGroup(department: string): Promise<void> {
  if (!department) return;
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
