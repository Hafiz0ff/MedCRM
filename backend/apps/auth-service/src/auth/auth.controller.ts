import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LoginSchema } from './dto/login.dto';
import { MfaConfirmDto, MfaConfirmSchema, MfaVerifyDto, MfaVerifySchema } from './dto/mfa.dto';
import { RefreshDto, RefreshSchema } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RbacGuard } from './guards/rbac.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with tenant code, email and password' })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    if (result.mfaRequired) {
      return { mfaRequired: true, mfaToken: result.mfaToken };
    }
    this.auth.attachRefreshCookie(response, result.refreshToken!);
    return { accessToken: result.accessToken, bootstrap: result.bootstrap };
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify 2FA code to complete login' })
  @UsePipes(new ZodValidationPipe(MfaVerifySchema))
  async verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.verifyMfa(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.auth.attachRefreshCookie(response, result.refreshToken!);
    return { accessToken: result.accessToken, bootstrap: result.bootstrap };
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate 2FA setup for current user' })
  async enableMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.enableMfa(user);
  }

  @Post('2fa/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Confirm 2FA setup by verifying code' })
  @UsePipes(new ZodValidationPipe(MfaConfirmSchema))
  async confirmMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaConfirmDto) {
    return this.auth.confirmMfa(user, dto);
  }

  @Post('2fa/disable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disable 2FA by verifying code' })
  @UsePipes(new ZodValidationPipe(MfaConfirmSchema))
  async disableMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaConfirmDto) {
    return this.auth.disableMfa(user, dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieToken = request.cookies?.refresh_token as string | undefined;
    const result = await this.auth.refresh(dto.refreshToken ?? cookieToken, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.auth.attachRefreshCookie(response, result.refreshToken!);
    return { accessToken: result.accessToken, bootstrap: result.bootstrap };
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(user);
    response.clearCookie('refresh_token');
    return { ok: true };
  }

  @Post('sessions/revoke-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke all active sessions for current user except the current one' })
  async revokeAllOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.revokeAllOtherSessions(user);
  }

  @Get('bootstrap')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermissions('auth.bootstrap.read')
  async bootstrap(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.auth.bootstrap(user, branchId);
  }
}
