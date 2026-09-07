import { escapeRegex } from '../utils/escapeRegex';

describe('escapeRegex', () => {
  it('leaves ordinary words untouched', () => {
    expect(escapeRegex('iftar programme')).toBe('iftar programme');
  });

  it('neutralises the characters that would change the pattern', () => {
    expect(new RegExp(escapeRegex('c++ (2024)')).test('c++ (2024)')).toBe(true);
  });

  it('makes a lone bracket safe instead of throwing', () => {
    // An unescaped '[' is an unterminated character class and crashes the query.
    expect(() => new RegExp(escapeRegex('['))).not.toThrow();
    expect(new RegExp(escapeRegex('[')).test('a[b')).toBe(true);
  });

  it('stops a wildcard from matching everything', () => {
    expect(new RegExp(escapeRegex('.*')).test('anything')).toBe(false);
    expect(new RegExp(escapeRegex('.*')).test('a.*b')).toBe(true);
  });

  it('escapes a backslash so it cannot start an escape of its own', () => {
    expect(new RegExp(escapeRegex('a\b')).test('a\b')).toBe(true);
  });

  it('handles an empty term', () => {
    expect(escapeRegex('')).toBe('');
  });
});
