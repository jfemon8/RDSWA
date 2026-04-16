import { z } from 'zod';

/** Transform empty strings to undefined so optional enum/string fields don't fail validation */
const emptyToUndefined = (val: string | undefined) => (val === '' ? undefined : val);
const optionalString = z.string().optional().transform(emptyToUndefined);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().transform(emptyToUndefined);

export const updateProfileSchema = z.object({
  avatar: optionalUrl,
  name: z.string().min(2).max(100).optional(),
  nameBn: optionalString,
  nickName: z.string().max(50, 'Nick name must be 50 characters or less').optional().transform(emptyToUndefined),
  phone: optionalString,
  dateOfBirth: optionalString,
  gender: z.enum(['male', 'female', 'other']).or(z.literal('')).optional().transform(emptyToUndefined),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).or(z.literal('')).optional().transform(emptyToUndefined),
  isBloodDonor: z.boolean().optional(),
  lastDonationDate: optionalString,
  nid: optionalString,
  presentAddress: z.object({
    division: optionalString,
    district: optionalString,
    upazila: optionalString,
    details: optionalString,
  }).optional(),
  permanentAddress: z.object({
    division: optionalString,
    district: optionalString,
    upazila: optionalString,
    details: optionalString,
  }).optional(),
  homeDistrict: optionalString,

  // Academic
  studentId: optionalString,
  registrationNumber: optionalString,
  batch: z.number().int().positive().optional(),
  session: optionalString,
  department: optionalString,
  university: optionalString,
  faculty: optionalString,
  admissionYear: z.number().int().optional(),
  expectedGraduation: z.number().int().optional(),

  // Professional
  profession: z.string().max(200).optional().transform(emptyToUndefined),
  jobHistory: z.array(z.object({
    company: z.string().default(''),
    position: z.string().default(''),
    startDate: optionalString,
    endDate: optionalString,
    isCurrent: z.boolean().default(false),
  })).optional(),
  businessInfo: z.array(z.object({
    businessName: z.string().default(''),
    type: z.string().default(''),
    startDate: optionalString,
    isCurrent: z.boolean().default(false),
  })).optional(),
  earningSource: optionalString,
  skills: z.array(z.string()).optional(),

  // Social
  facebook: optionalUrl,
  linkedin: optionalUrl,
  website: optionalUrl,

  // Profile visibility
  profileVisibility: z.object({
    phone: z.boolean().optional(),
    email: z.boolean().optional(),
    dateOfBirth: z.boolean().optional(),
    nid: z.boolean().optional(),
    presentAddress: z.boolean().optional(),
    permanentAddress: z.boolean().optional(),
    bloodGroup: z.boolean().optional(),
    studentId: z.boolean().optional(),
    registrationNumber: z.boolean().optional(),
    facebook: z.boolean().optional(),
    linkedin: z.boolean().optional(),
  }).optional(),

  // Notification prefs
  notificationPrefs: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    push: z.boolean().optional(),
    inApp: z.boolean().optional(),
    digestFrequency: z.enum(['none', 'daily', 'weekly']).optional(),
    dnd: z.boolean().optional(),
  }).optional(),
});

export const changeRoleSchema = z.object({
  // Tier roles only — alumni/advisor/senior_advisor are tags managed via separate grant endpoints
  role: z.enum(['guest', 'user', 'member', 'moderator', 'admin', 'super_admin']),
});

export const memberActionSchema = z.object({
  reason: z.string().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  batch: z.string().optional(),
  department: z.string().optional(),
  session: z.string().optional(),
  homeDistrict: z.string().optional(),
  bloodGroup: z.string().optional(),
  role: z.string().optional(),
  profession: z.string().optional(),
  search: z.string().optional(),
  membershipStatus: z.string().optional(),
  isAlumni: z.enum(['true', 'false']).optional(),
  isAdvisor: z.enum(['true', 'false']).optional(),
  isSeniorAdvisor: z.enum(['true', 'false']).optional(),
});
