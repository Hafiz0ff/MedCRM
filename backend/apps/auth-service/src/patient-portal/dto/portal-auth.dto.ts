import { z } from 'zod';

export const PortalOtpRequestSchema = z.object({
  phone: z.string().min(9).max(20),
});

export type PortalOtpRequestDto = z.infer<typeof PortalOtpRequestSchema>;

export const PortalOtpVerifySchema = z.object({
  phone: z.string().min(9).max(20),
  code: z.string().length(6),
});

export type PortalOtpVerifyDto = z.infer<typeof PortalOtpVerifySchema>;

export const PortalConnectSchema = z.object({
  tenantCode: z.string().min(2).max(120),
});

export type PortalConnectDto = z.infer<typeof PortalConnectSchema>;

export const PortalConnectPinSchema = z.object({
  pin: z.string().length(6),
});
export type PortalConnectPinDto = z.infer<typeof PortalConnectPinSchema>;

export const PortalConnectDeeplinkSchema = z.object({
  tenantCode: z.string().min(2),
  patientId: z.string().uuid(),
  expiresAt: z.number(),
  signature: z.string().min(32),
});
export type PortalConnectDeeplinkDto = z.infer<typeof PortalConnectDeeplinkSchema>;
