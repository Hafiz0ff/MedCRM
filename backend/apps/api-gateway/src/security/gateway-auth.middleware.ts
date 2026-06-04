import { Request, Response, NextFunction } from 'express';
import { GatewayRouteConfig } from '../gateway-route.config';
import { GatewayJwtVerifierService } from './gateway-jwt-verifier.service';
import { TRUSTED_IDENTITY_HEADERS } from './trusted-identity-headers';

/**
 * Creates an Express middleware for gateway-level authentication enforcement.
 * @param route Matched gateway route config.
 * @param verifier Instantiated GatewayJwtVerifierService.
 */
export function createGatewayAuthMiddleware(
  route: GatewayRouteConfig,
  verifier: GatewayJwtVerifierService,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawClientTenantId =
      req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'] || req.query['tenantId'];

    // 1. Strip all incoming identity headers from the client immediately to prevent spoofing
    for (const header of TRUSTED_IDENTITY_HEADERS) {
      delete req.headers[header];
      delete req.headers[header.toLowerCase()];
    }

    // 2. If the route does not require authentication, bypass validation
    if (!route.requiresAuth) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_MISSING',
          message: 'Bearer token in Authorization header is required',
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const token = authHeader.substring(7).trim();
    const isPortal = route.gatewayPrefix.startsWith('/portal') || req.path.includes('/portal');

    const authResult = await verifier.verify(token, isPortal);
    if (!authResult.ok) {
      const statusCode =
        authResult.code === 'TENANT_CONTEXT_MISSING' || authResult.code === 'TENANT_MISMATCH'
          ? 403
          : 401;

      res.status(statusCode).json({
        success: false,
        error: {
          code: authResult.code,
          message: authResult.message,
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const principal = authResult.principal;

    // 3. Prevent client-supplied header tenant mismatch
    if (rawClientTenantId && rawClientTenantId !== principal.tenantId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'The requested tenant ID does not match the authenticated session',
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 4. Validate branch access if specified
    const clientBranchId = req.headers['x-branch-id'];
    let finalBranchId = '';
    if (typeof clientBranchId === 'string' && principal.branchIds.includes(clientBranchId)) {
      finalBranchId = clientBranchId;
    } else {
      finalBranchId = principal.branchIds[0] || '';
    }

    // 5. Inject trusted downstream headers
    req.headers['x-user-id'] = principal.userId;
    req.headers['x-tenant-id'] = principal.tenantId;
    if (finalBranchId) {
      req.headers['x-branch-id'] = finalBranchId;
    }
    req.headers['x-roles'] = principal.roles.join(',');
    req.headers['x-permissions'] = principal.permissions.join(',');

    next();
  };
}
