/** Catalogue of accepted membership document types whose keys persist in `Form.attachments[i].name` and must therefore stay stable. */

export const ACADEMIC_DOC_TYPES = [
  { key: 'student_id', label: 'Student ID' },
  { key: 'university_id', label: 'University ID' },
  { key: 'admission_payslip', label: 'Admission Payslip' },
] as const;

export const IDENTITY_DOC_TYPES = [
  { key: 'nid', label: 'NID' },
  { key: 'passport', label: 'Passport' },
  { key: 'birth_certificate', label: 'Birth Certificate' },
  { key: 'driving_licence', label: 'Driving Licence' },
] as const;

export type DocTypeKey =
  | (typeof ACADEMIC_DOC_TYPES)[number]['key']
  | (typeof IDENTITY_DOC_TYPES)[number]['key'];

export type MembershipCriteria = {
  academicDocs: { enabled: boolean; accepted: string[] };
  identityDocs: { enabled: boolean; accepted: string[] };
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  allowedDivisions: string[];
  minBatch: number;
  maxPendingDays: number;
  autoRejectAfterDays: number;
};

export const DEFAULT_MEMBERSHIP_CRITERIA: MembershipCriteria = {
  academicDocs: {
    enabled: true,
    accepted: ACADEMIC_DOC_TYPES.map((d) => d.key),
  },
  identityDocs: {
    enabled: true,
    accepted: IDENTITY_DOC_TYPES.map((d) => d.key),
  },
  requireEmailVerification: false,
  requirePhoneVerification: false,
  allowedDivisions: ['Rangpur'],
  minBatch: 1,
  maxPendingDays: 7,
  autoRejectAfterDays: 30,
};

/** Resolve an attachment's display label from either a doc-type key or a legacy free-form name, falling back to the raw value. */
export function getDocLabel(name: string | undefined): string {
  if (!name) return '';
  const all = [...ACADEMIC_DOC_TYPES, ...IDENTITY_DOC_TYPES];
  return all.find((d) => d.key === name)?.label ?? name;
}
