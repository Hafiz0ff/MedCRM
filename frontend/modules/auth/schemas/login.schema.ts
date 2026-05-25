import { z } from 'zod';

export const loginSchema = z.object({
  tenantCode: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
