import { ServerResponse } from 'node:http';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, Options, fixRequestBody } from 'http-proxy-middleware';
import { GatewayRouteConfig } from './gateway-route.config';

const logger = new Logger('GatewayProxy');

function resolveTarget(config: ConfigService, route: GatewayRouteConfig): string {
  if (route.targetEnv.endsWith('_INTERNAL_URL')) {
    const internalUrl = config.get<string>(route.targetEnv);
    if (internalUrl) {
      return internalUrl;
    }
    const mainTargetEnv = route.targetEnv.replace(
      '_INTERNAL_URL',
      '_URL',
    ) as GatewayRouteConfig['targetEnv'];
    return config.getOrThrow<string>(mainTargetEnv);
  }
  return config.getOrThrow<string>(route.targetEnv);
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
        fixRequestBody(proxyReq, req);
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
        fixRequestBody(proxyReq, req);
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
