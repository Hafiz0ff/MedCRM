import { PrismaService } from '@core/database/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedPortalUser, JwtPortalPayload } from './patient-jwt-payload';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('PORTAL_JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPortalPayload): Promise<AuthenticatedPortalUser> {
    const session = await this.prisma.patientPortalSession.findUnique({
      where: { id: payload.session_id },
      select: { revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Portal session is not active');
    }

    return {
      accountId: payload.sub,
      phoneE164: payload.phone_e164,
      sessionId: payload.session_id,
    };
  }
}
