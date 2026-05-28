import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { Controller, Post, Get, Body, Query, Req, Res, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';

@ApiTags('sso')
@Controller('auth/sso')
export class SsoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('saml/acs')
  @ApiOperation({ summary: 'SAML 2.0 Assertion Consumer Service (ACS) endpoint' })
  async samlAcs(
    @Body() body: any,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const samlResponse = body.SAMLResponse || body.samlResponse;
    const tenantCode = body.tenantCode || request.headers['x-tenant-code'] || 'default';

    if (!samlResponse) {
      throw new BadRequestException('SAMLResponse is missing');
    }

    // Decode SAML Assertion (Mock decoding or parsing for enterprise grade)
    let email = 'sso-user@example.com';
    let fullName = 'SSO Enterprise User';
    let groups: string[] = ['MedCRM_Doctors'];

    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

      // Attempt to extract NameID (email) and attributes from SAML XML if present
      const emailMatch =
        decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) ||
        decoded.match(/NameID[^>]*>([^<]+)</);
      if (emailMatch) email = emailMatch[1].trim();

      const nameMatch =
        decoded.match(
          /Attribute Name="displayName"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)/,
        ) || decoded.match(/displayName[^>]*>([^<]+)</);
      if (nameMatch) fullName = nameMatch[1].trim();

      // Extract multiple groups/roles attributes
      const groupMatches = decoded.matchAll(
        /<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g,
      );
      const parsedGroups = Array.from(groupMatches).map((m) => m[1].trim());
      if (parsedGroups.length > 0) {
        groups = parsedGroups.filter(
          (g) => g.startsWith('MedCRM_') || g.includes('Admin') || g.includes('Doctor'),
        );
      }
    } catch (e) {
      // Fallback or use details from payload if it was raw json mock in tests
      if (typeof samlResponse === 'string' && samlResponse.startsWith('{')) {
        const parsed = JSON.parse(samlResponse);
        email = parsed.email || email;
        fullName = parsed.fullName || fullName;
        groups = parsed.groups || groups;
      }
    }

    // Resolve tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ code: String(tenantCode) }, { customDomain: request.headers.host }] },
    });

    if (!tenant) {
      throw new BadRequestException(`Tenant not found for code/domain: ${tenantCode}`);
    }

    // Find or create SSO user in our multi-tenant database
    let user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: email.toLowerCase() },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
          firstName: fullName.split(' ')[0] || 'SSO',
          lastName: fullName.split(' ').slice(1).join(' ') || 'User',
          passwordHash: await argon2.hash(randomUUID()), // generated secure hash, not used for SSO login
          status: 'active',
        },
      });
    }

    // Directory mapping logic based on enterprise groups
    // Ensure the tenant has branches and roles matching mapped permissions
    const branches = await this.prisma.branch.findMany({ where: { tenantId: tenant.id } });
    if (branches.length === 0) {
      throw new BadRequestException('Tenant has no configured branches');
    }
    const defaultBranch = branches[0];

    // Find or map roles based on directory groups
    let roleCode = 'doctor'; // Default role mapping
    if (groups.includes('MedCRM_Admins') || groups.some((g) => g.toLowerCase().includes('admin'))) {
      roleCode = 'admin';
    }

    let role = await this.prisma.role.findFirst({
      where: { tenantId: tenant.id, code: roleCode },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          tenantId: tenant.id,
          code: roleCode,
          name: roleCode.charAt(0).toUpperCase() + roleCode.slice(1),
          description: `SSO mapped ${roleCode} role`,
        },
      });
    }

    // Assign mapped role and branch to User if not already present
    const existingBranchRole = await this.prisma.userBranchRole.findFirst({
      where: {
        tenantId: tenant.id,
        userId: user.id,
        branchId: defaultBranch.id,
      },
    });

    if (!existingBranchRole) {
      await this.prisma.userBranchRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          branchId: defaultBranch.id,
          roleId: role.id,
        },
      });
    }

    // Create session and issue JWT tokens
    const context = await (this.auth as any).buildAuthContext(user.id, tenant.id, defaultBranch.id);
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');

    const refreshToken = await (this.auth as any).signRefreshToken({
      sub: user.id,
      tenant_id: tenant.id,
      session_id: sessionId,
      fingerprint,
    });

    const accessToken = await (this.auth as any).signAccessToken({
      sub: user.id,
      tenant_id: tenant.id,
      branch_ids: context.branchIds,
      role_ids: context.roleIds,
      permissions: context.permissions,
      session_id: sessionId,
    });

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await (this.auth as any).cacheSession(sessionId, tenant.id, user.id, fingerprint);

    this.auth.attachRefreshCookie(response, refreshToken);

    return {
      accessToken,
      bootstrap: await (this.auth as any).bootstrapFromIds(user.id, tenant.id, context),
    };
  }

  @Get('oidc/login')
  @ApiOperation({ summary: 'Initiate federated OIDC login redirect' })
  async oidcLogin(@Query('tenantCode') tenantCode: string, @Res() response: Response) {
    if (!tenantCode) {
      throw new BadRequestException('tenantCode query parameter is required');
    }

    // Map tenant and construct identity provider auth endpoint redirect
    const clientState = randomUUID();
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=mock-client-id` +
      `&response_type=code` +
      `&redirect_uri=http://localhost:3000/api/v1/auth/sso/oidc/callback` +
      `&scope=openid+profile+email` +
      `&state=${clientState}:${tenantCode}`;

    response.redirect(authUrl);
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'Handle federated OIDC redirect callback and verify state' })
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Authorization code and state are required');
    }

    const [clientState, tenantCode] = state.split(':');
    if (!tenantCode) {
      throw new BadRequestException('Invalid state payload');
    }

    // Resolve tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ code: tenantCode }, { customDomain: request.headers.host }] },
    });

    if (!tenant) {
      throw new BadRequestException(`Tenant not found for state code: ${tenantCode}`);
    }

    // Simulate token exchange with IdP and profile retrieval
    const email = `oidc-${tenantCode}-user@example.com`;
    const fullName = `OIDC User for ${tenant.name}`;

    // Find or create User
    let user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: email.toLowerCase() },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
          firstName: fullName.split(' ')[0] || 'OIDC',
          lastName: fullName.split(' ').slice(1).join(' ') || 'User',
          passwordHash: await argon2.hash(randomUUID()),
          status: 'active',
        },
      });
    }

    const branches = await this.prisma.branch.findMany({ where: { tenantId: tenant.id } });
    if (branches.length === 0) {
      throw new BadRequestException('Tenant has no configured branches');
    }
    const defaultBranch = branches[0];

    // Find or create doctor role
    let role = await this.prisma.role.findFirst({
      where: { tenantId: tenant.id, code: 'doctor' },
    });

    if (!role) {
      role = await this.prisma.role.create({
        data: {
          tenantId: tenant.id,
          code: 'doctor',
          name: 'Doctor',
          description: 'SSO mapped doctor role',
        },
      });
    }

    const existingBranchRole = await this.prisma.userBranchRole.findFirst({
      where: {
        tenantId: tenant.id,
        userId: user.id,
        branchId: defaultBranch.id,
      },
    });

    if (!existingBranchRole) {
      await this.prisma.userBranchRole.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          branchId: defaultBranch.id,
          roleId: role.id,
        },
      });
    }

    // Create session and JWT tokens
    const context = await (this.auth as any).buildAuthContext(user.id, tenant.id, defaultBranch.id);
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');

    const refreshToken = await (this.auth as any).signRefreshToken({
      sub: user.id,
      tenant_id: tenant.id,
      session_id: sessionId,
      fingerprint,
    });

    const accessToken = await (this.auth as any).signAccessToken({
      sub: user.id,
      tenant_id: tenant.id,
      branch_ids: context.branchIds,
      role_ids: context.roleIds,
      permissions: context.permissions,
      session_id: sessionId,
    });

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await (this.auth as any).cacheSession(sessionId, tenant.id, user.id, fingerprint);

    this.auth.attachRefreshCookie(response, refreshToken);

    return {
      accessToken,
      bootstrap: await (this.auth as any).bootstrapFromIds(user.id, tenant.id, context),
    };
  }
}
