import { userService } from '../services/user.service';

/** The filter builder is private, but it is the whole contract between a listing and its export. */
const buildFilter = (query: Record<string, string>, onlyDeleted = false) =>
  (userService as any).buildUserFilter(query, onlyDeleted);

describe('user export scope', () => {
  it('narrows to nothing when no filters are given, so /admin/users exports every user', () => {
    expect(buildFilter({})).toEqual({ isDeleted: { $ne: true } });
  });

  it('keeps the approved-only scope /admin/members asks for', () => {
    expect(buildFilter({ membershipStatus: 'approved' })).toEqual({
      isDeleted: { $ne: true },
      membershipStatus: 'approved',
    });
  });

  it('applies the batch and department filters the members page shows', () => {
    expect(buildFilter({ membershipStatus: 'approved', batch: '2019', department: 'CSE' })).toEqual({
      isDeleted: { $ne: true },
      membershipStatus: 'approved',
      batch: 2019,
      department: 'CSE',
    });
  });

  it('exports the deleted listing when asked for it', () => {
    expect(buildFilter({}, true)).toEqual({ isDeleted: true });
  });

  it('maps a legacy tag role onto its flag', () => {
    expect(buildFilter({ role: 'alumni' })).toEqual({ isDeleted: { $ne: true }, isAlumni: true });
  });

  it('keeps a tier role as a role', () => {
    expect(buildFilter({ role: 'moderator' })).toEqual({ isDeleted: { $ne: true }, role: 'moderator' });
  });

  it('searches the same fields the listing searches', () => {
    const filter = buildFilter({ search: 'rifat' });
    expect(filter.$and[0].$or.map((c: any) => Object.keys(c)[0])).toEqual([
      'name',
      'email',
      'studentId',
      'profession',
    ]);
  });

  it('escapes a search term instead of letting it act as a pattern', () => {
    expect(buildFilter({ search: 'a.*b' }).$and[0].$or[0].name.$regex).toBe('a\\.\\*b');
  });
});
