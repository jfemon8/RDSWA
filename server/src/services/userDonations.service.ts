import mongoose from 'mongoose';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

/** True when the viewer may see a donor's individual records rather than just their total. */
export function canSeeDonationDetails(
  donorId: string,
  viewerId?: string,
  viewerRole?: string
): boolean {
  if (viewerId && viewerId === donorId) return true;
  if (!viewerRole) return false;
  return ROLE_HIERARCHY.indexOf(viewerRole as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
}

/** Donations counted for a profile, where an outsider's total leaves out the ones the donor marked private. */
export function donationScopeFilter(donorId: string, canSeeDetails: boolean): Record<string, any> {
  const filter: Record<string, any> = {
    // Cast here because aggregate() never casts its pipeline, so a raw string id silently matches nothing.
    donor: new mongoose.Types.ObjectId(donorId),
    paymentStatus: 'completed',
    isDeleted: false,
  };
  if (!canSeeDetails) filter.visibility = 'public';
  return filter;
}
