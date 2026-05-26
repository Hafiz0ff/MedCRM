import { z } from 'zod';

export const appointmentCreatedEventSchema = z.object({
  appointmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  status: z.string(),
  appointmentNumber: z.string(),
});

export const appointmentCancelledEventSchema = z.object({
  appointmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  reason: z.string().optional(),
});

export const appointmentRescheduledEventSchema = z.object({
  appointmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  oldStartAt: z.string().datetime(),
  oldEndAt: z.string().datetime(),
  newStartAt: z.string().datetime(),
  newEndAt: z.string().datetime(),
  reason: z.string().optional(),
});

export type AppointmentCreatedEvent = z.infer<typeof appointmentCreatedEventSchema>;
export type AppointmentCancelledEvent = z.infer<typeof appointmentCancelledEventSchema>;
export type AppointmentRescheduledEvent = z.infer<typeof appointmentRescheduledEventSchema>;
