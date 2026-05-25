import { BadRequestException, Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<TInput, TOutput> implements PipeTransform<TInput, TOutput> {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  transform(value: TInput, metadata?: ArgumentMetadata): TOutput {
    // Bypass validation for custom decorators (like @CurrentUser) and route parameters (like @Param)
    if (metadata?.type === 'custom' || metadata?.type === 'param') {
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
