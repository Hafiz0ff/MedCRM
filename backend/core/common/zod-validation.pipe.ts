import { BadRequestException, Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { z, ZodSchema } from 'zod';

export const UuidParamSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const BranchHeaderSchema = z.string().uuid({ message: 'Invalid branch ID' }).optional();

/**
 * Custom validation pipe using Zod schema verification.
 */
@Injectable()
export class ZodValidationPipe<TInput, TOutput> implements PipeTransform<TInput, TOutput> {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  /**
   * Transforms and validates the input value against the schema.
   */
  transform(value: TInput, metadata?: ArgumentMetadata): TOutput {
    // Bypass validation ONLY for custom decorators (e.g. @CurrentUser)
    if (metadata?.type === 'custom') {
      return value as unknown as TOutput;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
