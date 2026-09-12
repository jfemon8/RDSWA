import { describe, it, expect } from 'vitest';
import { parseCsv, isStandardFontSafe, pageSlices } from '@/lib/downloadPdf';

describe('parseCsv', () => {
  it('keeps empty fields in place instead of collapsing the row', () => {
    expect(parseCsv('A,B,C\n"x","","z"').rows).toEqual([['x', '', 'z']]);
  });

  it('keeps a comma that sits inside a quoted field', () => {
    expect(parseCsv('A,B\n"Dhaka, Bangladesh","O+"').rows).toEqual([['Dhaka, Bangladesh', 'O+']]);
  });

  it('unescapes a doubled quote without splitting the field', () => {
    expect(parseCsv('A\n"say ""hi"" now"').rows).toEqual([['say "hi" now']]);
  });

  it('keeps a newline that sits inside a quoted field', () => {
    expect(parseCsv('A,B\n"line one\nline two","x"').rows).toEqual([['line one\nline two', 'x']]);
  });

  it('reads the unquoted header row', () => {
    expect(parseCsv('Name,Email\n"a","b"').headers).toEqual(['Name', 'Email']);
  });

  it('treats CRLF as one record separator', () => {
    expect(parseCsv('A,B\r\n"1","2"\r\n"3","4"').rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('ignores a trailing blank line', () => {
    expect(parseCsv('A\n"x"\n').rows).toEqual([['x']]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});

describe('isStandardFontSafe', () => {
  it('accepts the ASCII a built-in font can write', () => {
    expect(isStandardFontSafe('Name,Email\n"Rifat","a@b.com"')).toBe(true);
  });

  it('accepts Latin-1 accents', () => {
    expect(isStandardFontSafe('José, Zoë')).toBe(true);
  });

  it('rejects Bangla, which the built-in fonts drop', () => {
    expect(isStandardFontSafe('মোঃ জান্নাতুল')).toBe(false);
  });

  it('rejects typographic punctuation, which the built-in fonts also drop', () => {
    expect(isStandardFontSafe('Registrations — 2026')).toBe(false);
    expect(isStandardFontSafe('‘quoted’')).toBe(false);
  });
});

describe('pageSlices', () => {
  const rows = (count: number, height: number) =>
    Array.from({ length: count }, (_, i) => (i + 1) * height);

  it('ends every page on a row boundary', () => {
    const slices = pageSlices(rows(20, 30), 600, 250);
    let top = 0;
    for (const height of slices.slice(0, -1)) {
      top += height;
      expect(top % 30).toBe(0);
    }
  });

  it('never overflows the page', () => {
    for (const height of pageSlices(rows(20, 30), 600, 250)) {
      expect(height).toBeLessThanOrEqual(250);
    }
  });

  it('covers the capture exactly once, with no gap and no repeat', () => {
    const slices = pageSlices(rows(20, 30), 600, 250);
    expect(slices.reduce((sum, h) => sum + h, 0)).toBe(600);
  });

  it('uses a single page when everything fits', () => {
    expect(pageSlices(rows(3, 30), 90, 250)).toEqual([90]);
  });

  it('falls back to a hard cut for a row taller than the page', () => {
    expect(pageSlices([400], 400, 250)).toEqual([250, 150]);
  });

  it('ignores boundaries outside the capture', () => {
    expect(pageSlices([0, 120, 900], 120, 250)).toEqual([120]);
  });
});
