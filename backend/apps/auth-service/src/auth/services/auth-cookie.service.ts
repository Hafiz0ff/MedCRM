import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Service to attach and manage HTTP-only refresh cookies.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Attaches the refresh token HttpOnly cookie to the response object.
   */
  attachRefreshCookie(response: Response, refreshToken: string, req?: Request): void {
    const gatewayRoute = req?.headers?.['x-gateway-route'] as string | undefined;
    const path = gatewayRoute ? `${gatewayRoute}/refresh` : '/auth/refresh';
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      maxAge: SESSION_SECONDS * 1000,
      path,
    });
  }
}
