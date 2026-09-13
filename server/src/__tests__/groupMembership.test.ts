import { isHiddenMember, presentGroup, visibleMembers } from '../services/groupMembership.service';

const SUPER = 'super-1';
const CREATOR = 'creator-1';
const MENTOR = 'mentor-1';
const MEMBER = 'member-1';

// The SuperAdmin studies CSE, so the CSE group is the one department group they show in.
const supers = new Map<string, string | undefined>([[SUPER, 'CSE']]);

const custom = { type: 'custom', createdBy: CREATOR };
const consultation = { type: 'consultation', mentorUser: MENTOR, createdBy: MENTOR };
const ownDepartment = { type: 'department', department: 'CSE' };
const otherDepartment = { type: 'department', department: 'EEE' };

describe('hiding SuperAdmins from a group roster', () => {
  it('hides a SuperAdmin in a custom group', () => {
    expect(isHiddenMember(custom, SUPER, supers)).toBe(true);
  });

  it('hides a SuperAdmin in a consultation group', () => {
    expect(isHiddenMember(consultation, SUPER, supers)).toBe(true);
  });

  it('shows a SuperAdmin in the central group', () => {
    expect(isHiddenMember({ type: 'central' }, SUPER, supers)).toBe(false);
  });

  it('shows a SuperAdmin in their own department group', () => {
    expect(isHiddenMember(ownDepartment, SUPER, supers)).toBe(false);
  });

  it('hides a SuperAdmin in every other department group', () => {
    expect(isHiddenMember(otherDepartment, SUPER, supers)).toBe(true);
  });

  it('matches their own department despite stray whitespace', () => {
    expect(isHiddenMember({ type: 'department', department: ' CSE ' }, SUPER, supers)).toBe(false);
  });

  it('hides a SuperAdmin with no department in every department group', () => {
    const noDept = new Map<string, string | undefined>([[SUPER, undefined]]);
    expect(isHiddenMember(ownDepartment, SUPER, noDept)).toBe(true);
    expect(isHiddenMember(otherDepartment, SUPER, noDept)).toBe(true);
  });

  it('never hides an ordinary member', () => {
    expect(isHiddenMember(custom, MEMBER, supers)).toBe(false);
    expect(isHiddenMember(otherDepartment, MEMBER, supers)).toBe(false);
  });

  it('shows a SuperAdmin who founded the custom group themselves', () => {
    expect(isHiddenMember({ type: 'custom', createdBy: SUPER }, SUPER, supers)).toBe(false);
  });

  it('shows a SuperAdmin who mentors the consultation group', () => {
    expect(isHiddenMember({ type: 'consultation', mentorUser: SUPER }, SUPER, supers)).toBe(false);
  });

  it('reads a populated creator as well as a bare id', () => {
    expect(isHiddenMember({ type: 'custom', createdBy: { _id: SUPER, name: 'Emon' } }, SUPER, supers)).toBe(false);
  });
});

describe('what a client is sent', () => {
  it('drops hidden SuperAdmins from a list of ids', () => {
    expect(visibleMembers(custom, [CREATOR, MEMBER, SUPER], supers)).toEqual([CREATOR, MEMBER]);
  });

  it('drops hidden SuperAdmins from populated members', () => {
    const members = [{ _id: CREATOR, name: 'Creator' }, { _id: SUPER, name: 'Super' }];
    expect(visibleMembers(custom, members, supers)).toEqual([{ _id: CREATOR, name: 'Creator' }]);
  });

  it('keeps the member count honest, so a SuperAdmin is not counted', () => {
    const group = { ...custom, members: [CREATOR, MEMBER, SUPER], admins: [CREATOR, SUPER] };
    const presented = presentGroup(group, supers);
    expect(presented.members).toHaveLength(2);
    expect(presented.admins).toEqual([CREATOR]);
  });

  it('leaves a SuperAdmin on their own department roster and off another', () => {
    const own = presentGroup({ ...ownDepartment, members: [MEMBER, SUPER], admins: [SUPER] }, supers);
    const other = presentGroup({ ...otherDepartment, members: [MEMBER, SUPER], admins: [SUPER] }, supers);
    expect(own.members).toEqual([MEMBER, SUPER]);
    expect(other.members).toEqual([MEMBER]);
    expect(other.admins).toEqual([]);
  });

  it('leaves the central group untouched', () => {
    const group = { type: 'central', members: [MEMBER, SUPER], admins: [SUPER] };
    expect(presentGroup(group, supers)).toBe(group);
  });

  it('lets a consultation group with only its mentor and a hidden SuperAdmin count as empty', () => {
    // The teardown check reads this length, so a lingering SuperAdmin must not keep the group alive.
    expect(visibleMembers(consultation, [MENTOR, SUPER], supers)).toHaveLength(1);
  });
});
