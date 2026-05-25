import { REDIS_CLIENT } from '@core/cache/redis.module';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

export const HEAVY_ENDPOINT_KEY = 'rate-limit:heavy';
export const HeavyEndpoint = () => SetMetadata(HEAVY_ENDPOINT_KEY, true);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly reflector = new Reflector();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isHeavy =
      this.reflector.getAllAndOverride<boolean>(HEAVY_ENDPOINT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Identify tenantId from authenticated user first, then fallback to request headers or IP
    const tenantId =
      request.user?.tenantId ?? request.headers['x-tenant-id'] ?? request.ip ?? 'anonymous';

    const limit = isHeavy ? 10 : 100;
    const type = isHeavy ? 'heavy' : 'normal';

    const minute = Math.floor(Date.now() / 60000);
    const key = `rate_limit:${tenantId}:${type}:${minute}`;

    const [incrResult] = (await this.redis.multi().incr(key).expire(key, 60).exec()) as Array<
      [Error | null, any]
    >;

    if (incrResult[0]) {
      // Redis error, allow request by default so we don't block production
      return true;
    }

    const count = Number(incrResult[1]);

    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : 1;
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
