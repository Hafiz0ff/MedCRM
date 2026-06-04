import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Representation of active session metadata.
 */
export type ActiveSession = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date;
  createdAt: Date;
};

/**
 * Service to manage active sessions inside Redis and Prisma database.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Caches the session fingerprint and metadata inside Redis.
   */
  async cacheSession(
    sessionId: string,
    tenantId: string,
    userId: string,
    fingerprint: string,
  ): Promise<void> {
    await this.redis
      .multi()
      .hset(`session:${sessionId}:metadata`, { tenantId, userId })
      .set(`session:${sessionId}:fingerprint`, fingerprint, 'EX', SESSION_SECONDS)
      .del(`session:${sessionId}:revoked`)
      .expire(`session:${sessionId}:metadata`, SESSION_SECONDS)
      .exec();
  }

  /**
   * Revokes a session record by writing to DB and marking as revoked in Redis.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.set(`session:${sessionId}:revoked`, '1', 'EX', SESSION_SECONDS);
  }

  /**
   * Lists all active sessions for the user.
   */
  async getActiveSessions(user: AuthenticatedUser): Promise<ActiveSession[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId: user.userId,
        tenantId: user.tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  /**
   * Revokes all active sessions for the user except the specified one.
   */
  async revokeAllOtherSessions(user: AuthenticatedUser): Promise<{ count: number }> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId: user.userId,
        tenantId: user.tenantId,
        id: { not: user.sessionId },
        revokedAt: null,
      },
    });

    for (const session of sessions) {
      await this.revokeSession(session.id);
    }

    return { count: sessions.length };
  }

  /**
   * Revokes a specific session by ID.
   */
  async revokeSessionById(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: user.userId,
        tenantId: user.tenantId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or already revoked');
    }

    await this.revokeSession(sessionId);
    return { success: true };
  }
}
