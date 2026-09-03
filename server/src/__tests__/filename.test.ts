import { decodeMultipartFilename } from '../utils/filename';

/** Reproduces what busboy hands multer: UTF-8 bytes read back as latin1. */
function asBusboySees(name: string): string {
  return Buffer.from(name, 'utf8').toString('latin1');
}

describe('decodeMultipartFilename', () => {
  it('repairs a Bangla filename mangled by the latin1 default', () => {
    const original = 'প্রতিবেদন.pdf';
    const mangled = asBusboySees(original);

    expect(mangled).not.toBe(original);
    expect(decodeMultipartFilename(mangled)).toBe(original);
  });

  it('repairs mixed Bangla and English names', () => {
    const original = 'RDSWA বার্ষিক রিপোর্ট 2026.docx';
    expect(decodeMultipartFilename(asBusboySees(original))).toBe(original);
  });

  it('leaves a plain ASCII filename untouched', () => {
    expect(decodeMultipartFilename('annual-report.pdf')).toBe('annual-report.pdf');
  });

  it('leaves a name that already decoded correctly untouched', () => {
    const original = 'প্রতিবেদন.pdf';
    expect(decodeMultipartFilename(original)).toBe(original);
  });

  it('keeps latin1 bytes that are not valid UTF-8 rather than mangling them', () => {
    // A lone 0xE9 ("é" in latin1) is an invalid UTF-8 lead byte.
    const latin1Name = 'caf\xe9.pdf';
    expect(decodeMultipartFilename(latin1Name)).toBe(latin1Name);
  });

  it('passes empty input through', () => {
    expect(decodeMultipartFilename('')).toBe('');
  });

  it('survives a repeated decode so an already-fixed name is stable', () => {
    const original = 'সভার কার্যবিবরণী.pdf';
    const once = decodeMultipartFilename(asBusboySees(original));
    expect(decodeMultipartFilename(once)).toBe(original);
  });
});
