import { z } from 'zod';
import { FHIR_RESOURCE_TYPES } from '../fhir/fhir.types';

export const FhirExportQuerySchema = z
  .object({
    resourceType: z.enum(FHIR_RESOURCE_TYPES).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    _format: z.enum(['json', 'xml']).optional().default('json')
  })
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) return true;
      return new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime();
    },
    { message: 'dateFrom must be earlier than or equal to dateTo' }
  );

export type FhirExportQueryDto = z.infer<typeof FhirExportQuerySchema>;
