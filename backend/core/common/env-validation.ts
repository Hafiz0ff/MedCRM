import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  PORTAL_JWT_ACCESS_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),
  ENABLE_SWAGGER: z.string().optional(),
  INTERNAL_DOCS_AUTH_MODE: z
    .enum(['api-key', 'ip-allowlist', 'jwt-admin', 'none'])
    .optional()
    .default('none'),
  INTERNAL_DOCS_API_KEY_HASH: z.string().optional(),
  INTERNAL_DOCS_ALLOWED_IPS: z.string().optional(),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  const env = result.data;

  const kmsKey = process.env.KMS_MASTER_KEY;
  if (env.NODE_ENV === 'production') {
    if (!kmsKey) {
      throw new Error('KMS_MASTER_KEY is required in production');
    }
  }
  if (kmsKey) {
    if (kmsKey.length < 32) {
      throw new Error('KMS_MASTER_KEY must be at least 32 characters long');
    }
    const lowerKms = kmsKey.toLowerCase();
    if (
      lowerKms.includes('change_me') ||
      lowerKms.includes('default') ||
      lowerKms.includes('test')
    ) {
      throw new Error('KMS_MASTER_KEY cannot contain default, change_me, or test values');
    }
  }

  if (env.NODE_ENV === 'production') {
    if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET.includes('change_me')) {
      throw new Error('Unsafe production JWT_ACCESS_SECRET detected');
    }
    if (env.JWT_REFRESH_SECRET && env.JWT_REFRESH_SECRET.includes('change_me')) {
      throw new Error('Unsafe production JWT_REFRESH_SECRET detected');
    }
    if (env.PORTAL_JWT_ACCESS_SECRET && env.PORTAL_JWT_ACCESS_SECRET.includes('change_me')) {
      throw new Error('Unsafe production PORTAL_JWT_ACCESS_SECRET detected');
    }
    if (env.DATABASE_URL && env.DATABASE_URL.includes('medcrm_password')) {
      throw new Error('Unsafe production DATABASE_URL default password detected');
    }
    if (
      env.MINIO_ROOT_PASSWORD &&
      (env.MINIO_ROOT_PASSWORD === 'medcrm_minio_password' ||
        env.MINIO_ROOT_PASSWORD === 'minioadmin')
    ) {
      throw new Error('Unsafe production MINIO_ROOT_PASSWORD default password detected');
    }
    if (
      env.ENABLE_SWAGGER === 'true' &&
      (!env.INTERNAL_DOCS_AUTH_MODE || env.INTERNAL_DOCS_AUTH_MODE === 'none')
    ) {
      throw new Error(
        'Unsafe production config: ENABLE_SWAGGER is enabled but INTERNAL_DOCS_AUTH_MODE is not configured or set to none',
      );
    }
    if (env.INTERNAL_DOCS_AUTH_MODE === 'api-key' && !env.INTERNAL_DOCS_API_KEY_HASH) {
      throw new Error(
        'Unsafe production config: INTERNAL_DOCS_API_KEY_HASH must be configured when auth mode is api-key',
      );
    }
    if (env.INTERNAL_DOCS_AUTH_MODE === 'ip-allowlist' && !env.INTERNAL_DOCS_ALLOWED_IPS) {
      throw new Error(
        'Unsafe production config: INTERNAL_DOCS_ALLOWED_IPS must be configured when auth mode is ip-allowlist',
      );
    }
  }
}
