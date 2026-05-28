import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TelehealthService {
  private readonly logger = new Logger(TelehealthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates a secure multi-tenant scoped LiveKit Room Token
   */
  async generateRoomToken(
    roomName: string,
    participantName: string,
    tenantId: string,
  ): Promise<{ token: string; serverUrl: string; roomName: string; participantId: string }> {
    this.logger.log(
      `Generating LiveKit room token for tenant=${tenantId} room=${roomName} participant=${participantName}`,
    );

    const livekitSecret = this.config.get<string>(
      'LIVEKIT_API_SECRET',
      'mock-livekit-secret-key-12345',
    );
    const serverUrl = this.config.get<string>(
      'LIVEKIT_SERVER_URL',
      'wss://livekit.medcrm.internal',
    );
    const participantId = `usr_${randomUUID().split('-')[0]}`;

    // Standard LiveKit JWT structure
    // See: https://docs.livekit.io/realtime/access-tokens/
    const payload = {
      sub: participantId,
      iss: this.config.get<string>('LIVEKIT_API_KEY', 'devkey'),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2 hours expiry
      nbf: Math.floor(Date.now() / 1000) - 5,
      video: {
        room: roomName,
        roomJoin: true,
        roomCreate: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      metadata: JSON.stringify({
        tenantId,
        participantName,
        createdAt: new Date().toISOString(),
      }),
    };

    const token = await this.jwt.signAsync(payload, {
      secret: livekitSecret,
    });

    return {
      token,
      serverUrl,
      roomName,
      participantId,
    };
  }
}
