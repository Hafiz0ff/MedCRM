import { z } from 'zod';

export const LoginSchema = z.object({
  tenantCode: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  branchId: z.string().uuid().optional(),
  deviceName: z.string().max(255).optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
