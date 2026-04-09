import { z } from 'zod';

// ── Operator ──

export const createOperatorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contactNumber: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().max(10000).optional(),
  logo: z.string().url().optional().or(z.literal('')),
  scheduleType: z.enum(['university', 'intercity', 'both']).optional(),
});

export const updateOperatorSchema = createOperatorSchema.partial();

// ── Route ──

const stopSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().min(0),
});

export const createRouteSchema = z.object({
  origin: z.string().min(1, 'Origin is required').max(200),
  destination: z.string().min(1, 'Destination is required').max(200),
  stops: z.array(stopSchema).optional(),
  distanceKm: z.number().positive().optional(),
  estimatedDuration: z.string().max(50).optional(),
  routeType: z.enum(['university', 'intercity']),
});

export const updateRouteSchema = createRouteSchema.partial();

// ── Schedule ──

const daysEnum = z.enum(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']);

const scheduleBusSchema = z.object({
  operator: z.string().min(1, 'Operator is required'),
  busName: z.string().max(200).optional(),
  busCategory: z.enum(['ac', 'non_ac', 'sleeper', 'economy']).optional(),
});

const seasonalVariationSchema = z.object({
  season: z.string().min(1).max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  adjustedDepartureTime: z.string().optional(),
  adjustedArrivalTime: z.string().optional(),
  note: z.string().max(500).optional(),
}).optional();

export const createScheduleSchema = z.object({
  route: z.string().min(1, 'Route is required'),
  buses: z.array(scheduleBusSchema).min(1, 'At least one bus is required'),
  departureTime: z.string().min(1, 'Departure time is required'),
  arrivalTime: z.string().optional(),
  daysOfOperation: z.array(daysEnum).optional(),
  isSpecialSchedule: z.boolean().optional(),
  specialScheduleNote: z.string().max(500).optional(),
  seasonalVariation: seasonalVariationSchema,
  additionalInfo: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

// ── Counter ──

export const createCounterSchema = z.object({
  operator: z.string().min(1, 'Operator is required'),
  name: z.string().min(1, 'Name is required').max(200),
  location: z.string().max(300).optional(),
  phoneNumbers: z.array(z.string().max(20)).optional(),
  bookingLink: z.string().url().optional().or(z.literal('')),
});

export const updateCounterSchema = createCounterSchema.partial();

// ── Review ──

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// ── CSV Import ──

export const csvImportSchema = z.object({
  type: z.enum(['operators', 'routes', 'schedules', 'counters']),
});
