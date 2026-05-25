import { z } from 'zod';

export const patientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  tagId: z.string().uuid().optional(),
});

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  middleName: z.string().trim().max(120).optional(),
  birthDate: z.string().date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  phone: z.string().trim().min(3).max(80).optional(),
  email: z.string().email().max(255).optional(),
  registrationBranchId: z.string().uuid().optional(),
  status: z.enum(['NEW', 'ACTIVE', 'SLEEPING', 'VIP', 'BLOCKED', 'ARCHIVED']).default('NEW'),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
  status: z.enum(['NEW', 'ACTIVE', 'SLEEPING', 'VIP', 'BLOCKED', 'ARCHIVED']).optional(),
});

export const createContactSchema = z.object({
  type: z.enum(['PHONE', 'EMAIL', 'TELEGRAM', 'VIBER', 'OTHER']),
  value: z.string().trim().min(3).max(80),
  isPrimary: z.boolean().optional().default(false),
});

export const updateContactSchema = createContactSchema.partial();

export const mergePatientsSchema = z.object({
  primaryPatientId: z.string().uuid(),
  secondaryPatientId: z.string().uuid(),
});

export const patientStatusTransitionSchema = z.object({
  status: z.enum(['NEW', 'ACTIVE', 'SLEEPING', 'VIP', 'BLOCKED', 'ARCHIVED']),
});

export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
export type CreatePatientDto = z.infer<typeof createPatientSchema>;
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;
export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
export type MergePatientsDto = z.infer<typeof mergePatientsSchema>;
export type PatientStatusTransitionDto = z.infer<typeof patientStatusTransitionSchema>;
