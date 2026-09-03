import { contributionOf, campaignDeltas } from '../services/donation.service';
import { createDonationSchema, updateDonationSchema } from '../validators/donation.validator';

const C1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const C2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const USER = '507f1f77bcf86cd799439011';

describe('contributionOf', () => {
  it('counts a completed donation that belongs to a campaign', () => {
    expect(contributionOf({ campaign: C1, amount: 500, paymentStatus: 'completed' })).toEqual({
      campaign: C1,
      amount: 500,
    });
  });

  it('ignores a completed donation with no campaign', () => {
    expect(contributionOf({ amount: 500, paymentStatus: 'completed' })).toBeNull();
  });

  it.each(['pending', 'failed', 'refunded', 'revision'])('ignores a %s donation', (status) => {
    expect(contributionOf({ campaign: C1, amount: 500, paymentStatus: status })).toBeNull();
  });
});

describe('campaignDeltas', () => {
  const completed = (campaign: string, amount: number) => ({ campaign, amount });

  it('adds the amount when a donation is created already completed', () => {
    expect(campaignDeltas(null, completed(C1, 500))).toEqual([{ campaign: C1, inc: 500 }]);
  });

  it('adds the amount when a pending donation is verified', () => {
    expect(campaignDeltas(null, completed(C1, 250))).toEqual([{ campaign: C1, inc: 250 }]);
  });

  it('releases the amount when a completed donation is deleted', () => {
    // This is the bug that left campaign totals permanently inflated.
    expect(campaignDeltas(completed(C1, 500), null)).toEqual([{ campaign: C1, inc: -500 }]);
  });

  it('releases the amount when a completed donation is refunded', () => {
    expect(campaignDeltas(completed(C1, 500), null)).toEqual([{ campaign: C1, inc: -500 }]);
  });

  it('applies only the difference when the amount is edited', () => {
    expect(campaignDeltas(completed(C1, 500), completed(C1, 1000))).toEqual([{ campaign: C1, inc: 500 }]);
    expect(campaignDeltas(completed(C1, 1000), completed(C1, 400))).toEqual([{ campaign: C1, inc: -600 }]);
  });

  it('moves the amount between campaigns when the campaign is changed', () => {
    expect(campaignDeltas(completed(C1, 500), completed(C2, 500))).toEqual([
      { campaign: C1, inc: -500 },
      { campaign: C2, inc: 500 },
    ]);
  });

  it('does nothing when neither state contributes', () => {
    expect(campaignDeltas(null, null)).toEqual([]);
  });

  it('does nothing when an edit changes neither amount nor campaign', () => {
    expect(campaignDeltas(completed(C1, 500), completed(C1, 500))).toEqual([]);
  });
});

describe('donation schemas', () => {
  const base = { amount: 100, paymentMethod: 'cash' as const };

  it('accepts a submission with no date, leaving the server to stamp today', () => {
    expect(createDonationSchema.parse(base).donationDate).toBeUndefined();
  });

  it('accepts an explicit donation date', () => {
    expect(createDonationSchema.parse({ ...base, donationDate: '2026-09-02' }).donationDate).toBe('2026-09-02');
  });

  it('rejects an unparseable donation date', () => {
    expect(() => createDonationSchema.parse({ ...base, donationDate: 'last tuesday' })).toThrow();
  });

  it('accepts a donor id for an admin-attributed donation', () => {
    expect(createDonationSchema.parse({ ...base, donor: USER }).donor).toBe(USER);
  });

  it("accepts an empty donor for a donor who has no account", () => {
    expect(createDonationSchema.parse({ ...base, donor: '' }).donor).toBe('');
  });

  it('rejects a malformed donor id', () => {
    expect(() => createDonationSchema.parse({ ...base, donor: 'not-an-id' })).toThrow();
  });

  it('allows any status to be set on create', () => {
    expect(createDonationSchema.parse({ ...base, paymentStatus: 'completed' }).paymentStatus).toBe('completed');
  });

  it('rejects an unknown status', () => {
    expect(() => createDonationSchema.parse({ ...base, paymentStatus: 'approved' })).toThrow();
  });

  it('lets an update send any single field on its own', () => {
    expect(updateDonationSchema.parse({ amount: 750 })).toEqual({ amount: 750 });
    expect(updateDonationSchema.parse({ paymentStatus: 'refunded' })).toEqual({ paymentStatus: 'refunded' });
  });

  it('still validates fields it is given on update', () => {
    expect(() => updateDonationSchema.parse({ amount: -5 })).toThrow();
    expect(() => updateDonationSchema.parse({ donationDate: 'nope' })).toThrow();
  });
});
