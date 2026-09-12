import { updateProfileSchema } from '../validators/user.validator';

describe('updateProfileSchema: blood donor fields', () => {
  it('drops an unset last donation date instead of storing an empty value', () => {
    const parsed = updateProfileSchema.parse({ isBloodDonor: true, bloodGroup: 'O+', lastDonationDate: '' });
    expect(parsed).toEqual({ isBloodDonor: true, bloodGroup: 'O+', lastDonationDate: undefined });
    // JSON is how the service strips undefined before it reaches Mongoose.
    expect(JSON.parse(JSON.stringify(parsed))).not.toHaveProperty('lastDonationDate');
  });

  it('keeps a last donation date the donor picked', () => {
    expect(updateProfileSchema.parse({ lastDonationDate: '2026-09-09' }).lastDonationDate).toBe('2026-09-09');
  });

  it('lets a donor sign up without ever sending the date', () => {
    expect(updateProfileSchema.parse({ isBloodDonor: true, bloodGroup: 'AB-' })).toEqual({
      isBloodDonor: true,
      bloodGroup: 'AB-',
    });
  });

  it('rejects a blood group that is not a real one', () => {
    expect(() => updateProfileSchema.parse({ bloodGroup: 'C+' })).toThrow();
  });
});

describe('updateProfileSchema: fields a profile edit may not set', () => {
  it('strips role, membership status and auth fields', () => {
    const parsed = updateProfileSchema.parse({
      name: 'Rifat',
      role: 'super_admin',
      membershipStatus: 'approved',
      password: 'hunter2',
      email: 'someone@example.com',
      isEmailVerified: true,
    });
    expect(parsed).toEqual({ name: 'Rifat' });
  });
});
