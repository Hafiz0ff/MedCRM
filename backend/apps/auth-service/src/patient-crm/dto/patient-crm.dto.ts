import { z } from 'zod';

export const CrmTagSchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  color: z.string().max(40).optional().nullable(),
});
export type CrmTagDto = z.infer<typeof CrmTagSchema>;

export const FamilyGroupSchema = z.object({
  familyName: z.string().max(255).optional().nullable(),
  primaryContactPatientId: z.string().uuid().optional().nullable(),
  sharedBalanceEnabled: z.boolean().optional().default(false),
  sharedDiscountEnabled: z.boolean().optional().default(false),
});
export type FamilyGroupDto = z.infer<typeof FamilyGroupSchema>;

export const FamilyMemberSchema = z.object({
  familyGroupId: z.string().uuid(),
  patientId: z.string().uuid(),
  relationType: z.enum(['MOTHER', 'FATHER', 'SON', 'DAUGHTER', 'SPOUSE', 'GUARDIAN']),
  isPrimaryContact: z.boolean().optional().default(false),
  canReceiveNotifications: z.boolean().optional().default(true),
});
export type FamilyMemberDto = z.infer<typeof FamilyMemberSchema>;

export const LegalDocumentTypeSchema = z.object({
  code: z.string().min(2).max(120),
  name: z.string().min(2).max(255),
  validityPeriodDays: z.number().int().optional().nullable(),
  requiresSignature: z.boolean().optional().default(true),
  isRequired: z.boolean().optional().default(false),
  retentionPeriodDays: z.number().int().optional().nullable(),
});
export type LegalDocumentTypeDto = z.infer<typeof LegalDocumentTypeSchema>;

export const PatientLegalDocumentSchema = z.object({
  documentTypeId: z.string().uuid(),
  fileId: z.string().uuid().optional().nullable(),
  documentNumber: z.string().max(120).optional().nullable(),
  signedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  retentionUntil: z.string().datetime().optional().nullable(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'ARCHIVED']).default('ACTIVE'),
  signedByUserId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});
export type PatientLegalDocumentDto = z.infer<typeof PatientLegalDocumentSchema>;

export const PatientNoteSchema = z.object({
  note: z.string().min(1),
  visibility: z.enum(['PRIVATE', 'ADMIN_ONLY', 'SHARED']).default('SHARED'),
});
export type PatientNoteDto = z.infer<typeof PatientNoteSchema>;

export const PatientTimelineEventSchema = z.object({
  eventType: z.string().max(60),
  eventSource: z.string().max(60),
  title: z.string().max(255),
  description: z.string().optional().nullable(),
  metadataJson: z.any().optional().nullable(),
});
export type PatientTimelineEventDto = z.infer<typeof PatientTimelineEventSchema>;

export const PatientLeadSchema = z.object({
  sourceType: z.string().max(60),
  sourceName: z.string().max(120).optional().nullable(),
  campaignName: z.string().max(120).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  utmContent: z.string().max(120).optional().nullable(),
  utmTerm: z.string().max(120).optional().nullable(),
  conversionAt: z.string().datetime().optional().nullable(),
});
export type PatientLeadDto = z.infer<typeof PatientLeadSchema>;
