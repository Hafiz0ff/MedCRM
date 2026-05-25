import { z } from 'zod';

export const UpdateMedicalRecordSchema = z.object({
  bloodType: z.string().max(20).optional().nullable(),
  allergiesJson: z.any().optional().nullable(),
  chronicConditionsJson: z.any().optional().nullable(),
  emergencyContactsJson: z.any().optional().nullable(),
});
export type UpdateMedicalRecordDto = z.infer<typeof UpdateMedicalRecordSchema>;

export const CreateEpisodeOfCareSchema = z.object({
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  responsibleDoctorId: z.string().uuid(),
  episodeType: z.string().min(1).max(80),
  title: z.string().min(1).max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  clinicalSummary: z.string().optional().nullable(),
});
export type CreateEpisodeOfCareDto = z.infer<typeof CreateEpisodeOfCareSchema>;

export const UpdateEpisodeOfCareSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED', 'SUSPENDED']).optional(),
  endDate: z.string().datetime().optional().nullable(),
  clinicalSummary: z.string().optional().nullable(),
  responsibleDoctorId: z.string().uuid().optional(),
});
export type UpdateEpisodeOfCareDto = z.infer<typeof UpdateEpisodeOfCareSchema>;

export const SaveEncounterSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  episodeId: z.string().uuid().optional().nullable(),
  doctorEmployeeId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  encounterType: z.string().min(1).max(60),
  startedAt: z.string().datetime(),
  compositions: z
    .array(
      z.object({
        templateId: z.string().uuid().optional().nullable(),
        compositionType: z.string().min(1).max(60),
        title: z.string().min(1).max(255),
        sections: z.array(
          z.object({
            sectionCode: z.string().min(1).max(120),
            sectionName: z.string().min(1).max(255),
            sortOrder: z.number().int(),
            elements: z.array(
              z.object({
                fieldCode: z.string().min(1).max(120),
                fieldType: z.string().min(1).max(60),
                fieldValueJson: z.any(),
                unit: z.string().max(40).optional().nullable(),
                terminologyCode: z.string().max(120).optional().nullable(),
              }),
            ),
          }),
        ),
      }),
    )
    .optional(),
});
export type SaveEncounterDto = z.infer<typeof SaveEncounterSchema>;

export const SignEncounterSchema = z.object({
  certificateSerial: z.string().max(255).optional().nullable(),
  signatureProvider: z.string().min(1).max(60),
  signatureHash: z.string().min(1).max(255),
});
export type SignEncounterDto = z.infer<typeof SignEncounterSchema>;

export const AmendEncounterSchema = z.object({
  amendmentReason: z.string().min(5),
});
export type AmendEncounterDto = z.infer<typeof AmendEncounterSchema>;

export const CreateClinicalTemplateSchema = z.object({
  specialtyId: z.string().uuid().optional().nullable(),
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  version: z.number().int().min(1),
  schemaJson: z.any(),
  uiSchemaJson: z.any(),
});
export type CreateClinicalTemplateDto = z.infer<typeof CreateClinicalTemplateSchema>;

export const AssignDiagnosisSchema = z.object({
  diagnosisCode: z.string().min(1).max(80),
  diagnosisType: z.enum(['PRELIMINARY', 'CLINICAL', 'FINAL', 'DIFFERENTIAL']),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});
export type AssignDiagnosisDto = z.infer<typeof AssignDiagnosisSchema>;

export const CreatePrescriptionSchema = z.object({
  diagnosisId: z.string().uuid().optional().nullable(),
  prescriptionType: z.enum([
    'MEDICATION',
    'LAB_ORDER',
    'PROCEDURE',
    'IMAGING',
    'REFERRAL',
    'FOLLOW_UP',
  ]),
  notes: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        itemCode: z.string().min(1).max(120),
        itemName: z.string().min(1).max(255),
        dosage: z.string().max(120).optional().nullable(),
        frequency: z.string().max(120).optional().nullable(),
        duration: z.string().max(120).optional().nullable(),
        route: z.string().max(120).optional().nullable(),
        quantity: z.number().optional().nullable(),
        instructions: z.string().optional().nullable(),
        linkedServiceId: z.string().uuid().optional().nullable(),
      }),
    )
    .min(1),
});
export type CreatePrescriptionDto = z.infer<typeof CreatePrescriptionSchema>;

export const CreateLabOrderSchema = z.object({
  externalLabId: z.string().max(120).optional().nullable(),
  priority: z.string().min(1).max(40),
});
export type CreateLabOrderDto = z.infer<typeof CreateLabOrderSchema>;

export const CreateProcedureOrderSchema = z.object({
  procedureCode: z.string().min(1).max(120),
  roomRequirements: z.string().optional().nullable(),
  equipmentRequirements: z.string().optional().nullable(),
  scheduledAppointmentId: z.string().uuid().optional().nullable(),
});
export type CreateProcedureOrderDto = z.infer<typeof CreateProcedureOrderSchema>;
