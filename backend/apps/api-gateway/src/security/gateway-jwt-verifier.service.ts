import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { GatewayAuthResult, GatewayPrincipal } from './gateway-auth.types';

@Injectable()
export class GatewayJwtVerifierService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Decodes and verifies the signatures of standard or portal JWT tokens.
   * @param token Bearer JWT token string.
   * @param isPortal True if the route is a portal route using the portal secrets.
   */
  async verify(token: string, isPortal: boolean): Promise<GatewayAuthResult> {
    try {
      const secretStr = this.config.get<string>(
        isPortal ? 'PORTAL_JWT_ACCESS_SECRET' : 'JWT_ACCESS_SECRET',
      );
      if (!secretStr) {
        return {
          ok: false,
          code: 'AUTH_TOKEN_INVALID',
          message: 'Authentication configuration secret is missing',
        };
      }

      const secret = new TextEncoder().encode(secretStr);
      const { payload } = await jose.jwtVerify(token, secret);

      if (!payload.sub || typeof payload.sub !== 'string') {
        return {
          ok: false,
          code: 'AUTH_TOKEN_INVALID',
          message: 'Subject claim (sub) is missing or invalid',
        };
      }

      if (!payload.tenant_id || typeof payload.tenant_id !== 'string') {
        return {
          ok: false,
          code: 'TENANT_CONTEXT_MISSING',
          message: 'Tenant identity (tenant_id) is missing in token payload',
        };
      }

      const branchIds = Array.isArray(payload.branch_ids) ? payload.branch_ids.map(String) : [];
      const roles = Array.isArray(payload.role_ids) ? payload.role_ids.map(String) : [];
      const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : [];

      const principal: GatewayPrincipal = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        branchIds,
        roles,
        permissions,
        tokenId: typeof payload.session_id === 'string' ? payload.session_id : undefined,
      };

      return { ok: true, principal };
    } catch (err: any) {
      if (err.code === 'ERR_JWT_EXPIRED') {
        return {
          ok: false,
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'The authentication token has expired',
        };
      }
      return {
        ok: false,
        code: 'AUTH_TOKEN_INVALID',
        message: err.message || 'The token signature or format is invalid',
      };
    }
  }
}
