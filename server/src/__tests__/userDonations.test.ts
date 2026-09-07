import mongoose from 'mongoose';
import { canSeeDonationDetails, donationScopeFilter } from '../services/userDonations.service';
import { UserRole } from '@rdswa/shared';

const DONOR = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';

describe('canSeeDonationDetails', () => {
  it('lets the donor see their own records', () => {
    expect(canSeeDonationDetails(DONOR, DONOR, UserRole.USER)).toBe(true);
  });

  it('lets an admin see anyone records', () => {
    expect(canSeeDonationDetails(DONOR, OTHER, UserRole.ADMIN)).toBe(true);
  });

  it('lets a super admin see anyone records', () => {
    expect(canSeeDonationDetails(DONOR, OTHER, UserRole.SUPER_ADMIN)).toBe(true);
  });

  it.each([UserRole.GUEST, UserRole.USER, UserRole.MEMBER, UserRole.MODERATOR])(
    'keeps records from a %s who is not the donor',
    (role) => {
      // A moderator is deliberately below the bar here, unlike most privileged reads.
      expect(canSeeDonationDetails(DONOR, OTHER, role)).toBe(false);
    }
  );

  it('keeps records from a signed-out visitor', () => {
    expect(canSeeDonationDetails(DONOR)).toBe(false);
    expect(canSeeDonationDetails(DONOR, undefined, undefined)).toBe(false);
  });

  it('does not treat a missing viewer id as a match for a missing donor id', () => {
    expect(canSeeDonationDetails('', undefined, UserRole.USER)).toBe(false);
  });
});

describe('donationScopeFilter', () => {
  it('counts only completed donations that are not deleted', () => {
    expect(donationScopeFilter(DONOR, true)).toEqual({
      donor: new mongoose.Types.ObjectId(DONOR),
      paymentStatus: 'completed',
      isDeleted: false,
    });
  });

  it('hands aggregate a real ObjectId, which it will never cast for us', () => {
    // A raw string here matches nothing and silently reports a zero total.
    const { donor } = donationScopeFilter(DONOR, true);
    expect(donor).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(donor)).toBe(DONOR);
  });

  it('leaves private donations out of an outsider total', () => {
    // The donor chose not to be publicly tied to those amounts, so their profile must not undo that.
    expect(donationScopeFilter(DONOR, false)).toEqual({
      donor: new mongoose.Types.ObjectId(DONOR),
      paymentStatus: 'completed',
      isDeleted: false,
      visibility: 'public',
    });
  });

  it('includes private donations for the donor and admins', () => {
    expect(donationScopeFilter(DONOR, true).visibility).toBeUndefined();
  });

  it('never counts a pending or refunded donation', () => {
    expect(donationScopeFilter(DONOR, true).paymentStatus).toBe('completed');
    expect(donationScopeFilter(DONOR, false).paymentStatus).toBe('completed');
  });
});
