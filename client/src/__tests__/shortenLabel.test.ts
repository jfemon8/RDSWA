import { describe, it, expect } from 'vitest';
import { shortenLabel } from '@/lib/shortenLabel';

describe('shortenLabel', () => {
  it('leaves a short department name whole', () => {
    expect(shortenLabel('Physics')).toBe('Physics');
    expect(shortenLabel('Chemistry')).toBe('Chemistry');
    expect(shortenLabel('Soil Science')).toBe('Soil Science');
  });

  it('initialises a long name, dropping the ampersand', () => {
    expect(shortenLabel('Computer Science & Engineering')).toBe('CSE');
    expect(shortenLabel('Biochemistry & Biotechnology')).toBe('BB');
    expect(shortenLabel('Geology & Mining')).toBe('GM');
  });

  it('drops filler words so the initials stay meaningful', () => {
    expect(shortenLabel('Institute of Modern Languages')).toBe('IML');
    expect(shortenLabel('Bachelor of Science in Nursing')).toBe('BSN');
  });

  it('trims a single long word rather than reducing it to one letter', () => {
    expect(shortenLabel('Oceanography')).toBe('Oceanography');
    expect(shortenLabel('Pharmaceuticalsciences')).toBe('Pharmaceutica…');
  });

  it('splits on slashes and hyphens too', () => {
    expect(shortenLabel('Marketing/International Business')).toBe('MIB');
  });

  it('handles an empty or missing label', () => {
    expect(shortenLabel('')).toBe('');
    expect(shortenLabel(undefined as unknown as string)).toBe('');
  });
});
