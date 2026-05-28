import { ServerResponse } from 'node:http';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { GatewayRouteConfig } from './gateway-route.config';

const logger = new Logger('GatewayProxy');

function resolveTarget(config: ConfigService, route: GatewayRouteConfig): string {
  if (route.targetEnv === 'AUTH_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('AUTH_SERVICE_INTERNAL_URL') ??
      config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001')
    );
  }
  if (route.targetEnv === 'SCHEDULING_SERVICE_URL') {
    return config.get<string>('SCHEDULING_SERVICE_URL', 'http://localhost:3003');
  }
  if (route.targetEnv === 'SCHEDULING_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('SCHEDULING_SERVICE_INTERNAL_URL') ??
      config.get<string>('SCHEDULING_SERVICE_URL', 'http://localhost:3003')
    );
  }
  if (route.targetEnv === 'INTEGRATIONS_SERVICE_URL') {
    return config.get<string>('INTEGRATIONS_SERVICE_URL', 'http://localhost:3005');
  }
  if (route.targetEnv === 'INTEGRATIONS_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('INTEGRATIONS_SERVICE_INTERNAL_URL') ??
      config.get<string>('INTEGRATIONS_SERVICE_URL', 'http://localhost:3005')
    );
  }
  if (route.targetEnv === 'ANALYTICS_SERVICE_URL') {
    return config.get<string>('ANALYTICS_SERVICE_URL', 'http://localhost:3007');
  }
  if (route.targetEnv === 'ANALYTICS_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('ANALYTICS_SERVICE_INTERNAL_URL') ??
      config.get<string>('ANALYTICS_SERVICE_URL', 'http://localhost:3007')
    );
  }
  if (route.targetEnv === 'BILLING_SERVICE_URL') {
    return config.get<string>('BILLING_SERVICE_URL', 'http://localhost:3009');
  }
  if (route.targetEnv === 'BILLING_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('BILLING_SERVICE_INTERNAL_URL') ??
      config.get<string>('BILLING_SERVICE_URL', 'http://localhost:3009')
    );
  }

  return config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
}

function rewritePath(path: string, route: GatewayRouteConfig): string {
  const suffix = path.startsWith(route.gatewayPrefix)
    ? path.slice(route.gatewayPrefix.length)
    : path;
  return `${route.upstreamPrefix}${suffix}`;
}

function isServerResponse(value: unknown): value is ServerResponse {
  return typeof value === 'object' && value !== null && 'writeHead' in value && 'end' in value;
}

export function createGatewayProxy(config: ConfigService, route: GatewayRouteConfig) {
  const target = resolveTarget(config, route);
  const options: Options = {
    target,
    changeOrigin: true,
    xfwd: true,
    ws: route.kind === 'websocket',
    pathRewrite: (path) => rewritePath(path, route),
    on: {
      proxyReq: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'];
        if (typeof requestId === 'string') {
          proxyReq.setHeader('X-Request-Id', requestId);
        }
        const correlationId = req.headers['x-correlation-id'];
        if (typeof correlationId === 'string') {
          proxyReq.setHeader('X-Correlation-Id', correlationId);
        }
        proxyReq.setHeader('X-Gateway-Route', route.gatewayPrefix);
        proxyReq.setHeader('X-Gateway-Kind', route.kind);
      },
      proxyReqWs: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'];
        if (typeof requestId === 'string') {
          proxyReq.setHeader('X-Request-Id', requestId);
        }
        const correlationId = req.headers['x-correlation-id'];
        if (typeof correlationId === 'string') {
          proxyReq.setHeader('X-Correlation-Id', correlationId);
        }

        const authorization = req.headers.authorization;
        if (typeof authorization === 'string') {
          proxyReq.setHeader('Authorization', authorization);
        }

        proxyReq.setHeader('X-Gateway-Route', route.gatewayPrefix);
        proxyReq.setHeader('X-Gateway-Kind', route.kind);
      },
      error: (error, req, res) => {
        logger.error(`Proxy error route=${route.gatewayPrefix} target=${target}: ${error.message}`);
        if (!isServerResponse(res)) {
          res.end();
          return;
        }

        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'BAD_GATEWAY',
              message: 'Upstream service is unavailable',
              details: {
                route: route.gatewayPrefix,
                target,
                reason: error.message,
              },
              requestId: req.headers['x-request-id'] || 'unknown',
              timestamp: new Date().toISOString(),
            },
          }),
        );
      },
    },
  };

  return createProxyMiddleware(options);
}
