import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '@/lib/date';

describe('formatTimestamp', () => {
  it('renders dd/mm/yyyy, hh:mm:ss AM/PM', () => {
    expect(formatTimestamp('2026-09-03T09:20:05.000Z')).toBe('03/09/2026, 03:20:05 PM');
  });

  it('reads the clock in Dhaka, not the machine timezone', () => {
    // 20:30 UTC is already the next calendar day in Dhaka.
    expect(formatTimestamp('2026-09-03T20:30:00.000Z')).toBe('04/09/2026, 02:30:00 AM');
  });

  it('pads a single-digit day and month', () => {
    expect(formatTimestamp('2026-01-05T04:00:00.000Z')).toBe('05/01/2026, 10:00:00 AM');
  });

  it('shows midnight as 12 AM rather than 00', () => {
    expect(formatTimestamp('2026-09-02T18:00:00.000Z')).toBe('03/09/2026, 12:00:00 AM');
  });

  it('accepts a Date as readily as a string', () => {
    expect(formatTimestamp(new Date('2026-09-03T09:20:05.000Z'))).toBe('03/09/2026, 03:20:05 PM');
  });
});
