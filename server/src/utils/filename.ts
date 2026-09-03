/**
 * Repair a multipart filename that arrived as raw bytes instead of UTF-8.
 *
 * Busboy defaults `defParamCharset` to undefined and multer never sets it, so
 * `file.originalname` holds each UTF-8 byte as a separate latin1 character —
 * a Bangla name like "প্রতিবেদন.pdf" arrives as "à¦ªà§à¦°...".
 */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;

  // A codepoint above 0xFF means the name already decoded correctly.
  if (/[^\x00-\xff]/.test(name)) return name;

  const repaired = Buffer.from(name, 'latin1').toString('utf8');

  // A replacement char means these bytes were never UTF-8, so keep the original.
  return repaired.includes('�') ? name : repaired;
}
