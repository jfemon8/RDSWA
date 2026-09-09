import { ALL_AUTO_POSITIONS, CommitteePosition } from '@rdswa/shared';
import { titleCase } from '@/lib/utils';

/** Label used everywhere outside the admin committees page for the committee that has no end date. */
export const CURRENT_COMMITTEE_LABEL = 'Current Committee';

/** Positions only one sitting member may hold, mirroring the server's auto-role config defaults. */
export const UNIQUE_POSITIONS: string[] = ALL_AUTO_POSITIONS;

interface CommitteeLike {
  name?: string;
  isCurrent?: boolean;
  tenure?: { startDate?: string; endDate?: string };
}

/** The tenure decides what is current — a committee runs until it is given an end date — with the stored flag as the fallback for populated references that carry none. */
export function isCurrentCommittee(committee?: CommitteeLike | null): boolean {
  if (!committee) return false;
  if (committee.tenure) return !committee.tenure.endDate;
  return !!committee.isCurrent;
}

interface MemberLike {
  position?: string;
  designation?: string;
  leftAt?: string | Date | null;
}

/** The running committee is shown by its status rather than its stored name, so every surface names it the same way. */
export function committeeDisplayName(committee?: CommitteeLike | null): string {
  if (!committee) return '';
  return isCurrentCommittee(committee) ? CURRENT_COMMITTEE_LABEL : committee.name || '';
}

/** Turn a position slug into its readable form, e.g. "general_secretary" → "General Secretary". */
export function formatPosition(position?: string): string {
  if (!position) return '';
  return position.replace(/_/g, ' ');
}

/** A free-text designation replaces the generic "member" label, and every other post shows its own title. */
export function memberDisplayPosition(member?: MemberLike | null): string {
  if (!member) return '';
  const designation = member.designation?.trim();
  if (designation) return designation;
  return formatPosition(member.position);
}

/** Seniority order for display, taken from the order the positions are declared in. */
const POSITION_ORDER: string[] = Object.values(CommitteePosition);

/** Sitting members in seniority order, so every committee lists its leadership the same way. */
export function sortedActiveMembers<T extends MemberLike>(members: T[] = []): T[] {
  const rank = (position?: string) => {
    const index = POSITION_ORDER.indexOf(position || '');
    return index < 0 ? POSITION_ORDER.length : index;
  };
  return members.filter((m) => !m.leftAt).sort((a, b) => rank(a.position) - rank(b.position));
}

/** The running committee leads and the rest follow by newest tenure, whatever order the API returned. */
export function sortedCommittees<T extends CommitteeLike>(committees: T[] = []): T[] {
  return [...committees].sort((a, b) => {
    const byCurrent = Number(isCurrentCommittee(b)) - Number(isCurrentCommittee(a));
    if (byCurrent !== 0) return byCurrent;
    return (
      new Date(b.tenure?.startDate || 0).getTime() - new Date(a.tenure?.startDate || 0).getTime()
    );
  });
}

/** Positions already filled by a sitting member, which cannot take a second person until that seat is vacated. */
export function takenUniquePositions(members: MemberLike[]): string[] {
  return members
    .filter((m) => !m.leftAt && m.position && UNIQUE_POSITIONS.includes(m.position))
    .map((m) => m.position as string);
}

/** Whether a post takes a free-text designation, which only the generic Member post does. */
export function supportsDesignation(position: string): boolean {
  return position === CommitteePosition.MEMBER;
}

interface CommitteeWithMembers extends CommitteeLike {
  _id?: string;
  tenure?: { startDate?: string; endDate?: string };
  members?: Array<MemberLike & { user?: { _id?: string } | string }>;
}

export interface CommitteePostBadge {
  /** Badge text — the post on its own while serving, prefixed with "Former" once the committee is archived. */
  label: string;
  /** Which committee the post belongs to, shown on hover since the badge itself never names it. */
  tooltip: string;
  isCurrent: boolean;
}

/** The tenure years of a committee, e.g. "2024 - Present". */
function tenureLabel(committee: CommitteeWithMembers): string {
  const start = committee.tenure?.startDate ? new Date(committee.tenure.startDate).getFullYear() : null;
  const end = committee.tenure?.endDate ? new Date(committee.tenure.endDate).getFullYear() : 'Present';
  return start ? `${start} - ${end}` : '';
}

/** The post being served now plus the most recent past one, older posts left out because the badge carries no committee name to tell them apart. */
export function committeePostBadges(committees: CommitteeWithMembers[], userId?: string): CommitteePostBadge[] {
  if (!userId) return [];

  const held = committees.flatMap((committee) =>
    (committee.members || [])
      .filter((m) => {
        if (m.leftAt) return false;
        const memberId = typeof m.user === 'string' ? m.user : m.user?._id;
        return memberId === userId;
      })
      .map((member) => ({ committee, member }))
  );

  const badges: CommitteePostBadge[] = [];

  const serving = held.find((h) => isCurrentCommittee(h.committee));
  if (serving) {
    badges.push({
      label: titleCase(memberDisplayPosition(serving.member)),
      tooltip: [committeeDisplayName(serving.committee), tenureLabel(serving.committee)].filter(Boolean).join(' · '),
      isCurrent: true,
    });
  }

  const past = held
    .filter((h) => !isCurrentCommittee(h.committee))
    .sort((a, b) => committeeEndTime(b.committee) - committeeEndTime(a.committee))[0];
  if (past) {
    badges.push({
      label: `Former ${titleCase(memberDisplayPosition(past.member))}`,
      tooltip: [committeeDisplayName(past.committee), tenureLabel(past.committee)].filter(Boolean).join(' · '),
      isCurrent: false,
    });
  }

  return badges;
}

/** Sort key that puts the most recently finished committee first, falling back to its start date. */
function committeeEndTime(committee: CommitteeWithMembers): number {
  const date = committee.tenure?.endDate || committee.tenure?.startDate;
  return date ? new Date(date).getTime() : 0;
}
