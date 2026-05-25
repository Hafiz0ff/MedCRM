import { z } from 'zod';

export const LabOrderItemSchema = z.object({
  testCode: z.string().min(1).max(80),
  testName: z.string().min(1).max(255),
  loincCode: z.string().max(80).optional().nullable(),
  sampleType: z.string().max(120).optional().nullable(),
});

export const CreateLabOrderSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid(),
  providerId: z.string().uuid().optional().nullable(),
  priority: z.enum(['NORMAL', 'URGENT', 'STAT']).default('NORMAL'),
  items: z.array(LabOrderItemSchema).nonempty(),
});
export type CreateLabOrderDto = z.infer<typeof CreateLabOrderSchema>;

export const InboundObservationSchema = z.object({
  testCode: z.string().min(1).max(80),
  testName: z.string().min(1).max(255),
  value: z.string().min(1).max(255),
  unit: z.string().max(40).optional().nullable(),
  referenceRange: z.string().max(120).optional().nullable(),
  abnormalFlag: z.string().max(40).optional().nullable(), // H, L, N, etc.
});

export const SubmitLabResultSchema = z.object({
  externalOrderId: z.string().min(1),
  externalResultId: z.string().min(1),
  resultStatus: z.enum(['FINAL', 'PRELIMINARY', 'CORRECTED']).default('FINAL'),
  results: z.array(InboundObservationSchema).nonempty(),
  abnormalFlagsJson: z.any().optional().nullable(),
});
export type SubmitLabResultDto = z.infer<typeof SubmitLabResultSchema>;

export const UploadFileMetadataSchema = z.object({
  patientId: z.string().uuid().optional().nullable(),
  encounterId: z.string().uuid().optional().nullable(),
  labResultId: z.string().uuid().optional().nullable(),
  fileCategory: z.enum([
    'DICOM',
    'XRAY',
    'ULTRASOUND',
    'LAB_REPORT',
    'DOCUMENT',
    'AUDIO_CALL',
    'IMAGE',
    'PDF',
  ]),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  extension: z.string().min(1).max(20),
  fileSize: z.number().positive(),
});
export type UploadFileMetadataDto = z.infer<typeof UploadFileMetadataSchema>;

export const CallEventWebhookSchema = z.object({
  callId: z.string().min(1),
  providerCode: z.string().min(1),
  eventType: z.enum([
    'CALL_STARTED',
    'CALL_ANSWERED',
    'CALL_ENDED',
    'RECORDING_READY',
    'MISSED_CALL',
  ]),
  phone: z.string().min(1),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  durationSeconds: z.number().nonnegative().optional().nullable(),
  recordingUrl: z.string().url().optional().nullable(),
});
export type CallEventWebhookDto = z.infer<typeof CallEventWebhookSchema>;

export const DeviceMeasurementSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional().nullable(),
  deviceId: z.string().uuid(),
  measurementType: z.string().min(1).max(80),
  measurementData: z.any(),
});
export type DeviceMeasurementDto = z.infer<typeof DeviceMeasurementSchema>;
