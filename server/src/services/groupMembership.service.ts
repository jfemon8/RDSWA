import { Types } from 'mongoose';
import { ChatGroup, Mentorship, User } from '../models';
import { SUPER_ADMIN_EMAILS, UserRole } from '@rdswa/shared';

/** SuperAdmin ids mapped to their own trimmed department, which decides the one department group they show in. */
export type SuperAdminDirectory = ReadonlyMap<string, string | undefined>;

/** Every active SuperAdmin with their department, recognised by role or by the hardcoded email list. */
export async function superAdminDirectory(): Promise<SuperAdminDirectory> {
  const rows = await User.find({
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    $or: [{ role: UserRole.SUPER_ADMIN }, { email: { $in: SUPER_ADMIN_EMAILS } }],
  })
    .select('_id department')
    .lean();
  return new Map(rows.map((u) => [String(u._id), u.department?.trim() || undefined]));
}

/** Every active SuperAdmin's id, for seating them. */
export async function superAdminIds(): Promise<string[]> {
  return [...(await superAdminDirectory()).keys()];
}

/** The people a group's own logic seats there, which a hidden SuperAdmin is never counted among. */
function ownersOf(group: { createdBy?: unknown; mentorUser?: unknown }): Set<string> {
  const owners = new Set<string>();
  const id = (v: unknown) => (v && typeof v === 'object' && '_id' in (v as any) ? String((v as any)._id) : v ? String(v) : '');
  if (id(group.createdBy)) owners.add(id(group.createdBy));
  if (id(group.mentorUser)) owners.add(id(group.mentorUser));
  return owners;
}

/** Whether a member is one of the SuperAdmins this group keeps out of sight. */
export function isHiddenMember(
  group: { type?: string; department?: string; createdBy?: unknown; mentorUser?: unknown },
  memberId: string,
  superAdmins: SuperAdminDirectory
): boolean {
  if (!superAdmins.has(memberId)) return false;

  switch (group.type) {
    case 'central':
      return false;
    case 'department':
      // A SuperAdmin shows only in the group of the department they study in.
      return superAdmins.get(memberId) !== group.department?.trim();
    default:
      // The person who founded or mentors the group is part of it in their own right.
      return !ownersOf(group).has(memberId);
  }
}

/** A member list with the hidden SuperAdmins taken out, whether it holds ids or populated users. */
export function visibleMembers<T>(
  group: { type?: string; department?: string; createdBy?: unknown; mentorUser?: unknown },
  members: T[],
  superAdmins: SuperAdminDirectory
): T[] {
  return members.filter((m: any) => {
    const id = m && typeof m === 'object' && '_id' in m ? String(m._id) : String(m);
    return !isHiddenMember(group, id, superAdmins);
  });
}

/** A group ready to send to a client, with hidden SuperAdmins dropped from its members and admins. */
export function presentGroup<G extends { type?: string; department?: string; members?: any[]; admins?: any[] }>(
  group: G,
  superAdmins: SuperAdminDirectory
): G {
  if (group.type === 'central') return group;
  return {
    ...group,
    members: visibleMembers(group, group.members || [], superAdmins),
    admins: visibleMembers(group, group.admins || [], superAdmins),
  };
}

const ids = (list: unknown[] = []) => list.map(String);
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Holds the central, custom and consultation rosters to the rule: their own members plus SuperAdmins,
 * with no Admin or Moderator seated merely for their rank.
 */
export async function reconcileGroupRosters(): Promise<number> {
  const supers = await superAdminIds();
  const superSet = new Set(supers);
  let changed = 0;

  // Central holds every approved member, and its administration belongs to SuperAdmins alone.
  const central = await ChatGroup.findOne({ type: 'central', isDeleted: false }).select('_id members admins').lean();
  if (central) {
    const approved = await User.find({
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      membershipStatus: 'approved',
    })
      .select('_id')
      .lean();
    const members = [...new Set([...approved.map((u) => String(u._id)), ...supers])];
    if (!sameSet(ids(central.members), members) || !sameSet(ids(central.admins), supers)) {
      await ChatGroup.updateOne({ _id: central._id }, { $set: { members, admins: supers } });
      changed++;
    }
  }

  // Consultation holds its mentor and the mentees they are actively guiding.
  const consultations = await ChatGroup.find({ type: 'consultation', isDeleted: false })
    .select('_id mentorUser members admins')
    .lean();
  for (const group of consultations) {
    const mentor = group.mentorUser ? String(group.mentorUser) : null;
    const mentees = mentor
      ? (await Mentorship.find({ mentor, status: 'active' }).select('mentee').lean()).map((m) => String(m.mentee))
      : [];
    const members = [...new Set([...(mentor ? [mentor] : []), ...mentees, ...supers])];
    const admins = [...new Set([...(mentor ? [mentor] : []), ...supers])];
    if (!sameSet(ids(group.members), members) || !sameSet(ids(group.admins), admins)) {
      await ChatGroup.updateOne({ _id: group._id }, { $set: { members, admins } });
      changed++;
    }
  }

  // Custom groups have no admin-promotion path, so any admin other than the creator was seated for rank.
  const customs = await ChatGroup.find({ type: 'custom', isDeleted: false })
    .select('_id createdBy members admins')
    .lean();
  for (const group of customs) {
    const creator = group.createdBy ? String(group.createdBy) : null;
    const seatedForRank = ids(group.admins).filter((a) => a !== creator && !superSet.has(a));
    const members = [...new Set([...ids(group.members).filter((m) => !seatedForRank.includes(m)), ...supers])];
    const admins = [...new Set([...(creator ? [creator] : []), ...supers])];
    if (!sameSet(ids(group.members), members) || !sameSet(ids(group.admins), admins)) {
      await ChatGroup.updateOne({ _id: group._id }, { $set: { members, admins } });
      changed++;
    }
  }

  if (changed > 0) {
    console.log(`[groupRosters] Reconciled ${changed} central, custom or consultation roster(s)`);
  }
  return changed;
}

/** Seats one SuperAdmin in every group, visible only in the central group and their own department's. */
export async function seatSuperAdminEverywhere(userId: string | Types.ObjectId): Promise<void> {
  await ChatGroup.updateMany(
    { isDeleted: false },
    { $addToSet: { members: userId, admins: userId } }
  );
}
