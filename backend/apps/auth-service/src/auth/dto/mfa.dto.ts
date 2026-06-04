import { z } from 'zod';

export const MfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().regex(/^(\d{6}|\d{8})$/, { message: 'Code must be 6 or 8 digits' }),
  deviceName: z.string().max(255).optional(),
});

export const MfaConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: 'Code must be exactly 6 digits' }),
});

export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;
export type MfaConfirmDto = z.infer<typeof MfaConfirmSchema>;
