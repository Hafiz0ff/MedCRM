import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  PORTAL_JWT_ACCESS_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
  MINIO_ROOT_PASSWORD: z.string().optional(),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  const env = result.data;
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
  }
}
