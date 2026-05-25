import { z } from 'zod';

export const UpdateTenantProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  defaultLocale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(80).optional(),
});
export type UpdateTenantProfileDto = z.infer<typeof UpdateTenantProfileSchema>;

export const UpdateTenantModuleSchema = z.object({
  enabled: z.boolean().optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateTenantModuleDto = z.infer<typeof UpdateTenantModuleSchema>;
