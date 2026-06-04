import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { getClientIp, ipInCidr } from '../rate-limit/client-ip';
import { GatewayJwtVerifierService } from './gateway-jwt-verifier.service';

/**
 * Creates a production-grade middleware to lock down internal OpenAPI/Swagger documentation endpoints.
 * Supports API key, IP allowlist, and JWT admin verification.
 *
 * @param config NestJS ConfigService instance.
 * @param verifier Gateway JWT verifier service.
 */
export function createInternalDocsMiddleware(
  config: ConfigService,
  verifier: GatewayJwtVerifierService,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authMode = config.get<string>('INTERNAL_DOCS_AUTH_MODE', 'none');
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    const appEnv = config.get<string>('APP_ENV', 'local');
    const isLocal = nodeEnv === 'development' || nodeEnv === 'test' || appEnv === 'local';

    // Bypass auth in development/local environments when explicitly set to 'none'
    if (authMode === 'none') {
      if (isLocal) {
        return next();
      }
      res.status(403).json({
        success: false,
        error: {
          code: 'SWAGGER_FORBIDDEN',
          message: 'Access to documentation is disabled in production without auth mode config',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (authMode === 'api-key') {
      const clientKey = req.headers['x-internal-docs-key'];
      const expectedHash = config.get<string>('INTERNAL_DOCS_API_KEY_HASH');

      if (!expectedHash) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SWAGGER_CONFIG_ERROR',
            message: 'Server configuration error: missing API key hash',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (typeof clientKey === 'string') {
        const clientHash = crypto.createHash('sha256').update(clientKey).digest('hex');
        if (clientHash === expectedHash) {
          return next();
        }
      }

      res.status(401).json({
        success: false,
        error: {
          code: 'SWAGGER_UNAUTHORIZED',
          message: 'Invalid X-Internal-Docs-Key provided',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (authMode === 'ip-allowlist') {
      const allowedIpsStr = config.get<string>('INTERNAL_DOCS_ALLOWED_IPS');
      if (!allowedIpsStr) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SWAGGER_CONFIG_ERROR',
            message: 'Server configuration error: missing IP allowlist',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const trustedProxyCidrs = config
        .get<string>('GATEWAY_TRUSTED_PROXIES', '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const clientIp = getClientIp(req, trustedProxyCidrs);

      const allowedIps = allowedIpsStr
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      const isAllowed = allowedIps.some((allowedRange) => {
        if (allowedRange.includes('/')) {
          return ipInCidr(clientIp, allowedRange);
        }
        return clientIp === allowedRange.replace(/^::ffff:/, '');
      });

      if (isAllowed) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: {
          code: 'SWAGGER_FORBIDDEN',
          message: `Access denied from IP address: ${clientIp}`,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (authMode === 'jwt-admin') {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'SWAGGER_UNAUTHORIZED',
            message: 'Bearer token in Authorization header is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const token = authHeader.substring(7).trim();
      const authResult = await verifier.verify(token, false);
      if (!authResult.ok) {
        res.status(401).json({
          success: false,
          error: {
            code: authResult.code,
            message: authResult.message,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const roles = authResult.principal.roles.map((r) => r.toLowerCase());
      const permissions = authResult.principal.permissions.map((p) => p.toLowerCase());
      const isAdmin =
        roles.includes('admin') ||
        roles.includes('administrator') ||
        roles.includes('system_admin') ||
        permissions.includes('admin');

      if (isAdmin) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: {
          code: 'SWAGGER_FORBIDDEN',
          message: 'Insufficient administrative privileges to view documentation',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'SWAGGER_FORBIDDEN',
        message: 'Invalid documentation access configuration',
        timestamp: new Date().toISOString(),
      },
    });
  };
}
