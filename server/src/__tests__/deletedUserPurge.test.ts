import { purgeFilter } from '../jobs/deletedUserPurge';
import { purgeCutoff, RETENTION_DAYS } from '../config/retention';
import { UserRole } from '@rdswa/shared';

const DAY = 24 * 60 * 60 * 1000;

/** Whether a document would be picked up by the purge filter's `$or` on deletion age. */
const matchesAge = (filter: any, doc: any) =>
  filter.$or.some((clause: any) =>
    Object.entries(clause).every(([field, cond]: [string, any]) => {
      const value = doc[field];
      if (cond?.$exists === false) return value === undefined;
      if (cond?.$lte !== undefined) return value !== undefined && value !== null && value <= cond.$lte;
      return value === cond;
    }),
  );

describe('deleted account retention', () => {
  it('keeps an account for a year', () => {
    expect(RETENTION_DAYS).toBe(365);
    const now = new Date('2026-09-12T00:00:00.000Z');
    expect(purgeCutoff(now).toISOString()).toBe('2025-09-12T00:00:00.000Z');
  });

  it('only ever looks at soft-deleted accounts', () => {
    expect(purgeFilter(new Date()).isDeleted).toBe(true);
  });

  it('never purges a SuperAdmin', () => {
    expect(purgeFilter(new Date()).role).toEqual({ $ne: UserRole.SUPER_ADMIN });
  });

  it('purges an account deleted before the cutoff', () => {
    const cutoff = purgeCutoff();
    expect(matchesAge(purgeFilter(cutoff), { deletedAt: new Date(cutoff.getTime() - DAY) })).toBe(true);
  });

  it('spares an account deleted after the cutoff', () => {
    const cutoff = purgeCutoff();
    expect(matchesAge(purgeFilter(cutoff), { deletedAt: new Date(cutoff.getTime() + DAY) })).toBe(false);
  });

  it('falls back to updatedAt for accounts deleted before deletedAt was recorded', () => {
    const cutoff = purgeCutoff();
    const filter = purgeFilter(cutoff);
    expect(matchesAge(filter, { updatedAt: new Date(cutoff.getTime() - DAY) })).toBe(true);
    expect(matchesAge(filter, { updatedAt: new Date(cutoff.getTime() + DAY) })).toBe(false);
  });

  it('treats a null deletedAt the same as a missing one', () => {
    const cutoff = purgeCutoff();
    const filter = purgeFilter(cutoff);
    expect(matchesAge(filter, { deletedAt: null, updatedAt: new Date(cutoff.getTime() - DAY) })).toBe(true);
  });
});
