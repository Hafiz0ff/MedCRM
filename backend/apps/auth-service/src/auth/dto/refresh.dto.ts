import { z } from 'zod';

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export type RefreshDto = z.infer<typeof RefreshSchema>;
