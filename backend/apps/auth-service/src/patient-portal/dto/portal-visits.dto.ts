import { z } from 'zod';

export const PortalVisitsQuerySchema = z.object({
  tenantCode: z.string().min(2),
  status: z.enum(['UPCOMING', 'PAST', 'CANCELLED']).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type PortalVisitsQueryDto = z.infer<typeof PortalVisitsQuerySchema>;

export const PortalVisitDetailsQuerySchema = z.object({
  tenantCode: z.string().min(2),
  appointmentId: z.string().uuid(),
});

export type PortalVisitDetailsQueryDto = z.infer<typeof PortalVisitDetailsQuerySchema>;
