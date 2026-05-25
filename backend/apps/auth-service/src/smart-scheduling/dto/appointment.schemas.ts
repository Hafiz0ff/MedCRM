import { z } from 'zod';

export const appointmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  branchId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

export const createAppointmentSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  employeeId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  bookingSource: z.enum(['ADMIN_PANEL', 'ONLINE_WIDGET', 'TELEGRAM_BOT', 'WHATSAPP', 'PHONE_CALL', 'WALK_IN', 'API']).default('ADMIN_PANEL'),
  appointmentType: z.enum(['CONSULTATION', 'PROCEDURE', 'FOLLOW_UP', 'ONLINE_CONSULTATION', 'LAB_VISIT', 'DIAGNOSTIC']).default('CONSULTATION'),
  notes: z.string().max(2000).optional()
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']).optional(),
  cancellationReason: z.string().max(1000).optional()
});

export const reserveSlotSchema = z.object({
  branchId: z.string().uuid(),
  employeeId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime()
});

export const createWaitingListSchema = z.object({
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  employeeId: z.string().uuid().optional().nullable(),
  preferredDateFrom: z.string().date(),
  preferredDateTo: z.string().date(),
  preferredTimeFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  preferredTimeTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  notes: z.string().max(1000).optional().nullable()
});

export const updateWaitingListSchema = createWaitingListSchema.partial().extend({
  status: z.enum(['ACTIVE', 'MATCHED', 'CANCELLED', 'EXPIRED']).optional()
});

export const resourceBufferSchema = z.object({
  resourceType: z.enum(['EMPLOYEE', 'ROOM', 'EQUIPMENT']),
  resourceId: z.string().uuid(),
  beforeMinutes: z.number().int().min(0).default(0),
  afterMinutes: z.number().int().min(0).default(0)
});

export const recurrenceRuleSchema = z.object({
  recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.number().int().min(1).default(1),
  endDate: z.string().date().optional().nullable()
});

export const publicSlotsQuerySchema = z.object({
  branchId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  date: z.string().date()
});

export const onlineBookingReserveSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  employeeId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime()
});

export const onlineBookingConfirmSchema = z.object({
  token: z.string().min(10),
  code: z.string().min(4)
});

export const rescheduleSchema = z.object({
  newStartAt: z.string().datetime(),
  newEndAt: z.string().datetime(),
  reason: z.string().max(500).optional()
});

export const weekAvailabilityQuerySchema = z.object({
  branchId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  startDate: z.string().date()
});

export const roomUtilizationQuerySchema = z.object({
  branchId: z.string().uuid(),
  dateFrom: z.string().date(),
  dateTo: z.string().date()
});

export const createRecurringSchema = createAppointmentSchema.extend({
  recurrence: recurrenceRuleSchema
});

export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ReserveSlotDto = z.infer<typeof reserveSlotSchema>;

export type CreateWaitingListDto = z.infer<typeof createWaitingListSchema>;
export type UpdateWaitingListDto = z.infer<typeof updateWaitingListSchema>;
export type ResourceBufferDto = z.infer<typeof resourceBufferSchema>;
export type RecurrenceRuleDto = z.infer<typeof recurrenceRuleSchema>;
export type PublicSlotsQueryDto = z.infer<typeof publicSlotsQuerySchema>;
export type OnlineBookingReserveDto = z.infer<typeof onlineBookingReserveSchema>;
export type OnlineBookingConfirmDto = z.infer<typeof onlineBookingConfirmSchema>;
export type RescheduleDto = z.infer<typeof rescheduleSchema>;
export type WeekAvailabilityQuery = z.infer<typeof weekAvailabilityQuerySchema>;
export type RoomUtilizationQuery = z.infer<typeof roomUtilizationQuerySchema>;
export type CreateRecurringDto = z.infer<typeof createRecurringSchema>;

