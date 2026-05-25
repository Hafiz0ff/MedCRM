import { z } from 'zod';

export const PortalSlotsQuerySchema = z.object({
  tenantCode: z.string().min(2),
  branchId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type PortalSlotsQueryDto = z.infer<typeof PortalSlotsQuerySchema>;

export const PortalReserveSlotSchema = z.object({
  tenantCode: z.string().min(2),
  branchId: z.string().uuid(),
  employeeId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
export type PortalReserveSlotDto = z.infer<typeof PortalReserveSlotSchema>;

export const PortalConfirmBookingSchema = z.object({
  tenantCode: z.string().min(2),
  token: z.string().min(10),
  code: z.string().length(4),
});
export type PortalConfirmBookingDto = z.infer<typeof PortalConfirmBookingSchema>;

export const PortalCancelBookingSchema = z.object({
  tenantCode: z.string().min(2),
  appointmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type PortalCancelBookingDto = z.infer<typeof PortalCancelBookingSchema>;

export const PortalDoctorsQuerySchema = z.object({
  tenantCode: z.string().min(2),
  branchId: z.string().uuid(),
  specialtyId: z.string().uuid().optional(),
});
export type PortalDoctorsQueryDto = z.infer<typeof PortalDoctorsQuerySchema>;

export const PortalSpecialtiesQuerySchema = z.object({
  tenantCode: z.string().min(2),
});
export type PortalSpecialtiesQueryDto = z.infer<typeof PortalSpecialtiesQuerySchema>;
