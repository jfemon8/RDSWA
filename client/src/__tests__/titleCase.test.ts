import { describe, it, expect } from 'vitest';
import { titleCase } from '@/lib/utils';

describe('titleCase', () => {
  it('capitalises a single word', () => {
    expect(titleCase('monthly')).toBe('Monthly');
    expect(titleCase('bkash')).toBe('Bkash');
  });

  it('capitalises every word of a hyphenated slug', () => {
    expect(titleCase('one-time')).toBe('One-Time');
    expect(titleCase('event-based')).toBe('Event-Based');
    expect(titleCase('construction-fund')).toBe('Construction-Fund');
  });

  it('keeps the separators, so the label still reads as one token', () => {
    expect(titleCase('a-b-c')).toBe('A-B-C');
  });

  it('leaves digits and symbols alone', () => {
    expect(titleCase('bkash-2024')).toBe('Bkash-2024');
  });

  it('leaves an already-capitalised word unchanged', () => {
    expect(titleCase('Cash')).toBe('Cash');
  });

  it('handles an empty string', () => {
    expect(titleCase('')).toBe('');
  });
});
