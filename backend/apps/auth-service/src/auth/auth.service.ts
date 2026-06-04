import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable } from '@nestjs/common';
import { Response, Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { MfaConfirmDto, MfaVerifyDto } from './dto/mfa.dto';
import { AuthAuditService, RequestMetadata } from './services/auth-audit.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { BootstrapService, BootstrapPayload } from './services/bootstrap.service';
import { LoginService } from './services/login.service';
import { MfaService, TokenResult } from './services/mfa.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionService, ActiveSession } from './services/session.service';

/**
 * Thin Facade coordinating specialized authentication and session services.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly loginService: LoginService,
    private readonly refreshService: RefreshTokenService,
    private readonly sessionService: SessionService,
    private readonly mfaService: MfaService,
    private readonly bootstrapService: BootstrapService,
    private readonly cookieService: AuthCookieService,
    private readonly auditService: AuthAuditService,
  ) {}

  /**
   * authenticates credentials and registers session or launches MFA request.
   */
  async login(dto: LoginDto, metadata: RequestMetadata): Promise<TokenResult> {
    return this.loginService.login(dto, metadata);
  }

  /**
   * Refreshes active user tokens and rotates keys.
   */
  async refresh(refreshToken: string | undefined, metadata: RequestMetadata): Promise<TokenResult> {
    return this.refreshService.refresh(refreshToken, metadata);
  }

  /**
   * Revokes current session and logs out the user.
   */
  async logout(user: AuthenticatedUser): Promise<void> {
    await this.sessionService.revokeSession(user.sessionId);
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.logout',
    });
  }

  /**
   * Revokes all active sessions for this user except the current session.
   */
  async revokeAllOtherSessions(user: AuthenticatedUser): Promise<{ count: number }> {
    const result = await this.sessionService.revokeAllOtherSessions(user);
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.revoke_all_other_sessions',
      newValuesJson: { count: result.count },
    });
    return result;
  }

  /**
   * Returns list of active sessions for the user.
   */
  async getActiveSessions(user: AuthenticatedUser): Promise<ActiveSession[]> {
    return this.sessionService.getActiveSessions(user);
  }

  /**
   * Revokes a specific active session by ID.
   */
  async revokeSessionById(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    const result = await this.sessionService.revokeSessionById(user, sessionId);
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.session_revoked',
      newValuesJson: { sessionId },
    });
    return result;
  }

  /**
   * Resolves the startup configuration parameters (bootstrap) for the UI client.
   */
  async bootstrap(user: AuthenticatedUser, branchId?: string): Promise<BootstrapPayload> {
    return this.bootstrapService.bootstrap(user, branchId);
  }

  /**
   * Attaches HttpOnly refresh cookie to HTTP response headers.
   */
  attachRefreshCookie(response: Response, refreshToken: string, req?: Request): void {
    this.cookieService.attachRefreshCookie(response, refreshToken, req);
  }

  /**
   * Returns the current MFA status.
   */
  async getMfaStatus(user: AuthenticatedUser): Promise<{ isEnabled: boolean }> {
    return this.mfaService.getMfaStatus(user);
  }

  /**
   * Pre-enables MFA and returns TOTP shared secret configurations.
   */
  async enableMfa(user: AuthenticatedUser): Promise<{ secret: string; qrCodeUri: string }> {
    return this.mfaService.enableMfa(user);
  }

  /**
   * Confirms MFA registration and returns backup keys.
   */
  async confirmMfa(
    user: AuthenticatedUser,
    dto: MfaConfirmDto,
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    return this.mfaService.confirmMfa(user, dto);
  }

  /**
   * Deactivates MFA for the user session.
   */
  async disableMfa(user: AuthenticatedUser, dto: MfaConfirmDto): Promise<{ success: boolean }> {
    return this.mfaService.disableMfa(user, dto);
  }

  /**
   * Validates MFA challenge code.
   */
  async verifyMfa(dto: MfaVerifyDto, metadata: RequestMetadata): Promise<TokenResult> {
    return this.mfaService.verifyMfa(dto, metadata);
  }
}
