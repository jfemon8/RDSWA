import { ChatGroup, User } from '../models';
import {
  configuredDepartments,
  ensureDepartmentGroup,
  reconcileDepartmentGroups,
} from '../services/departmentGroup.service';
import { reconcileGroupRosters, superAdminIds } from '../services/groupMembership.service';

export { ensureDepartmentGroup };

/** Reconcile department chat groups against academicConfig, then hold each roster to the membership rule. */
export async function syncDepartmentGroups(): Promise<void> {
  const configured = await configuredDepartments();

  // Create what is missing and bring back what the config lists again.
  for (const dept of configured) {
    const existing = await ChatGroup.findOne({ type: 'department', department: dept });
    if (!existing) {
      await ensureDepartmentGroup(dept);
      console.log(`Department group created: ${dept}`);
    } else if (existing.isDeleted) {
      await ChatGroup.findByIdAndUpdate(existing._id, { $set: { isDeleted: false } });
      console.log(`Department group reactivated: ${dept}`);
    }
  }

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

  // Earlier versions seated every Admin in every department group, so rosters are rebuilt from the rule.
  await reconcileDepartmentGroups();
}

/** Ensure the central and department groups exist, then hold every roster to the membership rule, run once at startup. */
export async function initializeGroups(): Promise<void> {
  try {
    await ensureCentralGroup();
    await syncDepartmentGroups();
    // Earlier versions seated every Admin in the central, custom and consultation groups too.
    await reconcileGroupRosters();
  } catch (err) {
    console.error('Group initializer error:', err);
  }
}

/** Ensure the central "RDSWA, BU" group exists, seeded with every approved member and administered by SuperAdmins alone. */
export async function ensureCentralGroup(): Promise<void> {
  const existing = await ChatGroup.findOne({ type: 'central', isDeleted: false });
  if (existing) return;

  const [approvedMembers, supers] = await Promise.all([
    User.find({
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      membershipStatus: 'approved',
    }).select('_id').lean(),
    superAdminIds(),
  ]);

  await ChatGroup.create({
    name: 'RDSWA, BU',
    description: 'Central group for all RDSWA members',
    type: 'central',
    members: [...new Set([...approvedMembers.map((u) => u._id.toString()), ...supers])],
    admins: supers,
  });
  console.log('Central group created');
}
