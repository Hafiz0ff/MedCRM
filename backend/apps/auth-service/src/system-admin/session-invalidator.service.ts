import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

const REVOKED_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Revokes a user's active sessions both in PostgreSQL (audit trail) and in
 * Redis (so the realtime gateway and access-token middleware can deny calls
 * immediately, without waiting for the JWT to expire).
 */
@Injectable()
export class SessionInvalidatorService {
  private readonly logger = new Logger(SessionInvalidatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async revokeAllSessionsForUser(
    userId: string,
    tenantId: string,
    options: { reason: string } = { reason: 'rbac.policy.changed' },
  ): Promise<{ count: number; sessionIds: string[] }> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, tenantId, revokedAt: null },
      select: { id: true },
    });

    if (sessions.length === 0) {
      return { count: 0, sessionIds: [] };
    }

    const sessionIds = sessions.map((s) => s.id);

    await this.prisma.userSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { revokedAt: new Date() },
    });

    const pipeline = this.redis.multi();
    for (const sessionId of sessionIds) {
      pipeline.set(`session:${sessionId}:revoked`, '1', 'EX', REVOKED_TTL_SECONDS);
    }
    await pipeline.exec();

    this.logger.log(
      `Revoked ${sessionIds.length} session(s) for user=${userId} tenant=${tenantId} reason=${options.reason}`,
    );
    return { count: sessionIds.length, sessionIds };
  }
}
