import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  nameBn: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  isBloodDonor: z.boolean().optional(),
  lastDonationDate: z.string().optional(),
  nid: z.string().optional(),
  presentAddress: z.object({
    division: z.string().optional(),
    district: z.string().optional(),
    upazila: z.string().optional(),
    details: z.string().optional(),
  }).optional(),
  permanentAddress: z.object({
    division: z.string().optional(),
    district: z.string().optional(),
    upazila: z.string().optional(),
    details: z.string().optional(),
  }).optional(),
  homeDistrict: z.string().optional(),

  // Academic
  studentId: z.string().optional(),
  registrationNumber: z.string().optional(),
  batch: z.number().int().positive().optional(),
  session: z.string().optional(),
  department: z.string().optional(),
  university: z.string().optional(),
  faculty: z.string().optional(),
  admissionYear: z.number().int().optional(),
  expectedGraduation: z.number().int().optional(),

  // Professional
  profession: z.string().max(200).optional(),
  jobHistory: z.array(z.object({
    company: z.string(),
    position: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    isCurrent: z.boolean(),
  })).optional(),
  businessInfo: z.array(z.object({
    businessName: z.string(),
    type: z.string(),
    startDate: z.string(),
    isCurrent: z.boolean(),
  })).optional(),
  earningSource: z.string().optional(),
  skills: z.array(z.string()).optional(),

  // Social
  facebook: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),

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
  role: z.enum([
    'guest', 'user', 'member', 'alumni', 'advisor',
    'senior_advisor', 'moderator', 'admin', 'super_admin',
  ]),
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
});
