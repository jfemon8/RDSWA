import { describe, it, expect } from 'vitest';
import { stripHtml } from '@/lib/stripHtml';

describe('stripHtml', () => {
  it('returns plain text untouched', () => {
    expect(stripHtml('Just words')).toBe('Just words');
  });

  it('takes the text out of markup', () => {
    expect(stripHtml('<p>Hello <strong>there</strong></p>')).toBe('Hello there');
  });

  it('yields nothing for markup that carries no text', () => {
    // An empty editor leaves tags behind, which must never reach the reader.
    expect(stripHtml('<h2></h2><p></p>')).toBe('');
    expect(stripHtml('<p><br></p>')).toBe('');
  });

  it('treats an empty document as empty for validation', () => {
    expect(stripHtml('<p></p>').trim()).toBeFalsy();
  });

  it('handles nothing at all', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('keeps the text of a partially empty document', () => {
    expect(stripHtml('<h2></h2><p>District: Gaibandha</p>')).toBe('District: Gaibandha');
  });
});
