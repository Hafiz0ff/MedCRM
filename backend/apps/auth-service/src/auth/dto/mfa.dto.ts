import { z } from 'zod';

export const MfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(6).max(8),
  deviceName: z.string().max(255).optional(),
});

export const MfaConfirmSchema = z.object({
  code: z.string().length(6),
});

export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;
export type MfaConfirmDto = z.infer<typeof MfaConfirmSchema>;
