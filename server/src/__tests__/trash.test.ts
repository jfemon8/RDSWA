import { stampDeletion } from '../models/plugins/softDelete';
import { trashPurgeFilter } from '../jobs/trashPurge';
import { TRASH_RESOURCES, findTrashResource } from '../config/trashResources';

const NOW = new Date('2026-09-12T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('soft-delete stamping', () => {
  it('stamps a top-level delete', () => {
    expect(stampDeletion({ isDeleted: true }, NOW)).toEqual({ isDeleted: true, deletedAt: NOW });
  });

  it('stamps a $set delete inside $set, not beside it', () => {
    expect(stampDeletion({ $set: { isDeleted: true } }, NOW)).toEqual({
      $set: { isDeleted: true, deletedAt: NOW },
    });
  });

  it('clears the stamp when a record is restored', () => {
    expect(stampDeletion({ $set: { isDeleted: false } }, NOW)).toEqual({
      $set: { isDeleted: false },
      $unset: { deletedAt: '' },
    });
  });

  it('leaves an unrelated update alone', () => {
    expect(stampDeletion({ $set: { title: 'Renamed' } }, NOW)).toEqual({
      $set: { title: 'Renamed' },
    });
  });

  it('keeps other $unset keys when clearing the stamp', () => {
    expect(stampDeletion({ $set: { isDeleted: false }, $unset: { archivedAt: '' } }, NOW).$unset).toEqual({
      archivedAt: '',
      deletedAt: '',
    });
  });
});

describe('trash purge filter', () => {
  const matchesAge = (filter: any, doc: any) =>
    filter.$or.some((clause: any) =>
      Object.entries(clause).every(([field, cond]: [string, any]) => {
        const value = doc[field];
        if (cond?.$exists === false) return value === undefined;
        if (cond?.$lte !== undefined) return value != null && value <= cond.$lte;
        return value === cond;
      }),
    );

  it('only looks at soft-deleted records', () => {
    expect(trashPurgeFilter(NOW).isDeleted).toBe(true);
  });

  it('purges a record deleted before the cutoff and spares a newer one', () => {
    const filter = trashPurgeFilter(NOW);
    expect(matchesAge(filter, { deletedAt: new Date(NOW.getTime() - DAY) })).toBe(true);
    expect(matchesAge(filter, { deletedAt: new Date(NOW.getTime() + DAY) })).toBe(false);
  });

  it('falls back to updatedAt when the stamp is missing or null', () => {
    const filter = trashPurgeFilter(NOW);
    const old = new Date(NOW.getTime() - DAY);
    expect(matchesAge(filter, { updatedAt: old })).toBe(true);
    expect(matchesAge(filter, { deletedAt: null, updatedAt: old })).toBe(true);
  });
});

describe('trash resource registry', () => {
  it('gives every resource a unique key', () => {
    const keys = TRASH_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers both the recoverable and the sweep-only collections', () => {
    expect(TRASH_RESOURCES.some((r) => r.recoverable)).toBe(true);
    expect(TRASH_RESOURCES.some((r) => !r.recoverable)).toBe(true);
  });

  it('selects deletedAt for every resource, which the listing and sweep both read', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(resource.select).toContain('deletedAt');
    }
  });

  it('names a record without throwing on an empty document', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(typeof resource.title({})).toBe('string');
      expect(resource.title({}).length).toBeGreaterThan(0);
    }
  });

  it('finds a resource by key and rejects an unknown one', () => {
    expect(findTrashResource('notices')?.label).toBe('Notices');
    expect(findTrashResource('nope')).toBeUndefined();
  });

  it('only registers models that carry the soft-delete flag', () => {
    for (const resource of TRASH_RESOURCES) {
      expect(resource.model.schema.path('isDeleted')).toBeDefined();
      expect(resource.model.schema.path('deletedAt')).toBeDefined();
    }
  });
});
