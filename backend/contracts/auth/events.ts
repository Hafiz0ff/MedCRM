import { z } from 'zod';

export const userCreatedEventSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.string(),
});

export const userLoginEventSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type UserCreatedEvent = z.infer<typeof userCreatedEventSchema>;
export type UserLoginEvent = z.infer<typeof userLoginEventSchema>;
