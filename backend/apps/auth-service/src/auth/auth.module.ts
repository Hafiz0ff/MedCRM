import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScimController } from '../sso/scim.controller';
import { SsoController } from '../sso/sso.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAuditService } from './services/auth-audit.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { BootstrapService } from './services/bootstrap.service';
import { LoginService } from './services/login.service';
import { MfaService } from './services/mfa.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController, SsoController, ScimController],
  providers: [
    AuthService,
    JwtStrategy,
    LoginService,
    RefreshTokenService,
    SessionService,
    MfaService,
    BootstrapService,
    AuthCookieService,
    AuthAuditService,
  ],
})
export class AuthModule {}
