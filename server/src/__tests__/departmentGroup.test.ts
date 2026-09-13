import { groupRoster, homeDepartment, isSuperAdminUser } from '../services/departmentGroup.service';
import { updateProfileSchema } from '../validators/user.validator';
import { SUPER_ADMIN_EMAILS, UserRole } from '@rdswa/shared';

let seq = 0;
const person = (over: Record<string, unknown>) => ({
  _id: `user-${++seq}`,
  email: `user${seq}@example.com`,
  role: UserRole.MEMBER,
  department: 'CSE',
  membershipStatus: 'approved',
  isDeleted: false,
  isActive: true,
  ...over,
});

const rosterOf = (candidates: any[]) => groupRoster('CSE', candidates);

describe('who sits in a department group', () => {
  it('seats an approved student of that department', () => {
    const student = person({});
    const { members, admins } = rosterOf([student]);
    expect(members).toEqual([student._id]);
    expect(admins).toEqual([]);
  });

  it('keeps an Admin of another department out, whatever their rank', () => {
    const outsider = person({ department: 'EEE', role: UserRole.ADMIN });
    expect(rosterOf([outsider]).members).toEqual([]);
  });

  it('keeps a Moderator of another department out', () => {
    const outsider = person({ department: 'EEE', role: UserRole.MODERATOR });
    expect(rosterOf([outsider]).members).toEqual([]);
  });

  it('seats an Admin of the same department as a member only, since rank earns no admin seat', () => {
    const admin = person({ role: UserRole.ADMIN });
    const { members, admins } = rosterOf([admin]);
    expect(members).toEqual([admin._id]);
    expect(admins).toEqual([]);
  });

  it('seats every SuperAdmin, even one from another department', () => {
    const superAdmin = person({ department: 'EEE', role: UserRole.SUPER_ADMIN });
    const { members, admins } = rosterOf([superAdmin]);
    expect(members).toEqual([superAdmin._id]);
    expect(admins).toEqual([superAdmin._id]);
  });

  it('recognises a SuperAdmin by email before their role has been promoted', () => {
    const byEmail = person({ department: 'EEE', role: UserRole.USER, email: SUPER_ADMIN_EMAILS[0] });
    expect(rosterOf([byEmail]).members).toEqual([byEmail._id]);
  });

  it('leaves out a student whose membership is not approved', () => {
    for (const membershipStatus of ['pending', 'rejected', 'suspended', 'none']) {
      expect([membershipStatus, rosterOf([person({ membershipStatus })]).members]).toEqual([membershipStatus, []]);
    }
  });

  it('leaves out a deleted or deactivated account', () => {
    expect(rosterOf([person({ isDeleted: true })]).members).toEqual([]);
    expect(rosterOf([person({ isActive: false })]).members).toEqual([]);
    expect(rosterOf([person({ role: UserRole.SUPER_ADMIN, isDeleted: true })]).members).toEqual([]);
  });

  it('leaves out someone with no department at all', () => {
    expect(rosterOf([person({ department: undefined })]).members).toEqual([]);
  });

  it('matches a department despite stray whitespace', () => {
    const student = person({ department: '  CSE ' });
    expect(rosterOf([student]).members).toEqual([student._id]);
  });

  it('builds a mixed roster exactly', () => {
    const cse = person({});
    const cseAdmin = person({ role: UserRole.ADMIN });
    const eeeAdmin = person({ department: 'EEE', role: UserRole.ADMIN });
    const superAdmin = person({ department: 'Math', role: UserRole.SUPER_ADMIN });
    const pending = person({ membershipStatus: 'pending' });

    const { members, admins } = rosterOf([cse, cseAdmin, eeeAdmin, superAdmin, pending]);
    expect(members.sort()).toEqual([cse._id, cseAdmin._id, superAdmin._id].sort());
    expect(admins).toEqual([superAdmin._id]);
  });
});

describe('home department', () => {
  it('is the trimmed department of an approved, active member', () => {
    expect(homeDepartment(person({ department: ' CSE ' }) as any)).toBe('CSE');
  });

  it('is nothing for anyone the rule does not seat', () => {
    expect(homeDepartment(person({ department: '' }) as any)).toBeNull();
    expect(homeDepartment(person({ membershipStatus: 'pending' }) as any)).toBeNull();
  });
});

describe('super admin detection', () => {
  it('trusts the role', () => {
    expect(isSuperAdminUser({ role: UserRole.SUPER_ADMIN })).toBe(true);
  });

  it('trusts the hardcoded email list', () => {
    expect(isSuperAdminUser({ role: UserRole.USER, email: SUPER_ADMIN_EMAILS[0] })).toBe(true);
  });

  it('does not treat an Admin as one', () => {
    expect(isSuperAdminUser({ role: UserRole.ADMIN, email: 'admin@example.com' })).toBe(false);
  });
});

describe('clearing a department from the profile', () => {
  it('turns an emptied department into an explicit removal', () => {
    expect(updateProfileSchema.parse({ department: '' }).department).toBeNull();
  });

  it('leaves the department alone when it is not sent', () => {
    expect(updateProfileSchema.parse({}).department).toBeUndefined();
  });

  it('keeps a department that was chosen', () => {
    expect(updateProfileSchema.parse({ department: 'CSE' }).department).toBe('CSE');
  });
});
