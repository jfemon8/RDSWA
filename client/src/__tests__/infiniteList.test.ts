import { describe, it, expect, vi, beforeEach } from 'vitest';
import { infiniteListOptions } from '@/hooks/useInfiniteList';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: (...args: any[]) => get(...args) } }));

const page = (n: number, hasNext: boolean, rows: any[] = []) => ({
  data: rows,
  pagination: { page: n, total: 57, totalPages: 3, hasNext },
});

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: page(1, true) });
});

describe('infiniteListOptions request building', () => {
  const opts = (over = {}) =>
    infiniteListOptions({ queryKey: ['x'], path: '/notices', limit: 12, ...over });

  it('always sends the page and limit the caller never has to think about', async () => {
    await opts().queryFn({ pageParam: 2 });
    expect(get).toHaveBeenCalledWith('/notices?page=2&limit=12');
  });

  it('appends the filters it was given', async () => {
    await opts({ filters: { category: 'urgent', search: 'fee' } }).queryFn({ pageParam: 1 });
    expect(get).toHaveBeenCalledWith('/notices?page=1&limit=12&category=urgent&search=fee');
  });

  it('drops empty and undefined filters instead of sending blank params', async () => {
    // An empty filter must not narrow the query to rows whose field is literally ''.
    await opts({ filters: { category: '', status: undefined, type: 'meeting' } }).queryFn({ pageParam: 1 });
    expect(get).toHaveBeenCalledWith('/notices?page=1&limit=12&type=meeting');
  });

  it('defaults the limit when none is given', async () => {
    await infiniteListOptions({ queryKey: ['x'], path: '/jobs' }).queryFn({ pageParam: 1 });
    expect(get).toHaveBeenCalledWith('/jobs?page=1&limit=20');
  });
});

describe('infiniteListOptions paging', () => {
  const next = infiniteListOptions({ queryKey: ['x'], path: '/notices' }).getNextPageParam;

  it('asks for the following page while the server says there is one', () => {
    expect(next(page(1, true))).toBe(2);
    expect(next(page(7, true))).toBe(8);
  });

  it('stops on the last page', () => {
    expect(next(page(3, false))).toBeUndefined();
  });

  it('stops when the endpoint returns no pagination block at all', () => {
    expect(next({ data: [] })).toBeUndefined();
  });
});
