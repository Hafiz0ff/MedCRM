import { z } from 'zod';

export const AuditLogQuerySchema = z
  .object({
    action: z.string().min(1).max(160).optional(),
    userId: z.string().uuid().optional(),
    entityType: z.string().min(1).max(120).optional(),
    entityId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  })
  .refine(
    (value) => {
      if (!value.dateFrom || !value.dateTo) return true;
      return new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime();
    },
    { message: 'dateFrom must be earlier than or equal to dateTo' },
  );
export type AuditLogQueryDto = z.infer<typeof AuditLogQuerySchema>;
