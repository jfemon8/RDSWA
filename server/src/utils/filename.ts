/** Repair a multipart filename whose UTF-8 bytes arrived as latin1 characters, because busboy leaves `defParamCharset` unset and multer never sets it. */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;

  // A codepoint above 0xFF means the name already decoded correctly.
  if (/[^\x00-\xff]/.test(name)) return name;

  const repaired = Buffer.from(name, 'latin1').toString('utf8');

  // A replacement char means these bytes were never UTF-8, so keep the original.
  return repaired.includes('�') ? name : repaired;
}
