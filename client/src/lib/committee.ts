import { ALL_AUTO_POSITIONS, CommitteePosition } from '@rdswa/shared';

/** Label used everywhere outside the admin committees page for the committee that has no end date. */
export const CURRENT_COMMITTEE_LABEL = 'Current Committee';

/** Positions only one sitting member may hold, mirroring the server's auto-role config defaults. */
export const UNIQUE_POSITIONS: string[] = ALL_AUTO_POSITIONS;

interface CommitteeLike {
  name?: string;
  isCurrent?: boolean;
}

interface MemberLike {
  position?: string;
  designation?: string;
  leftAt?: string | Date | null;
}

/** The running committee is shown by its status rather than its stored name, so every surface names it the same way. */
export function committeeDisplayName(committee?: CommitteeLike | null): string {
  if (!committee) return '';
  return committee.isCurrent ? CURRENT_COMMITTEE_LABEL : committee.name || '';
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

/** Positions already filled by a sitting member, which cannot take a second person until that seat is vacated. */
export function takenUniquePositions(members: MemberLike[]): string[] {
  return members
    .filter((m) => !m.leftAt && m.position && UNIQUE_POSITIONS.includes(m.position))
    .map((m) => m.position as string);
}

/** Only the generic Member post carries a free-text designation — every other post is its own title. */
export function supportsDesignation(position: string): boolean {
  return position === CommitteePosition.MEMBER;
}
