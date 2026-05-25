import { z } from 'zod';

export const CreateIntegrationProviderSchema = z.object({
  providerType: z.enum(['LIS', 'TELEPHONY', 'SMS', 'PAYMENT', 'STORAGE', 'DEVICE', 'EMAIL', 'FHIR']),
  providerCode: z.string().min(1).max(80),
  providerName: z.string().min(1).max(255),
  authenticationType: z.enum(['API_KEY', 'HMAC', 'OAUTH2']),
  rateLimitPerMinute: z.number().int().positive().max(10_000).optional().default(60),
  configuration: z.record(z.string(), z.unknown()).optional().default({})
});
export type CreateIntegrationProviderDto = z.infer<typeof CreateIntegrationProviderSchema>;

export const UpdateIntegrationProviderSchema = z.object({
  providerName: z.string().min(1).max(255).optional(),
  rateLimitPerMinute: z.number().int().positive().max(10_000).optional(),
  isActive: z.boolean().optional(),
  configuration: z.record(z.string(), z.unknown()).optional()
});
export type UpdateIntegrationProviderDto = z.infer<typeof UpdateIntegrationProviderSchema>;
