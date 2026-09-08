import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

describe('settings query keys', () => {
  it('keeps the admin read on a key of its own', () => {
    // The endpoint strips fields for non-admins, so one key for both shapes serves the wrong one.
    expect(queryKeys.settings.admin).not.toEqual(queryKeys.settings.all);
  });

  it('nests the admin key under the public one so a prefix invalidation still clears it', () => {
    expect(queryKeys.settings.admin.slice(0, 1)).toEqual([...queryKeys.settings.all]);
  });
});
