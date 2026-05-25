import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { gatewayRoutes } from './gateway-route.config';
import { OpenApiAggregatorService } from './openapi-aggregator.service';

@ApiTags('gateway')
@Controller('gateway')
export class OpenApiController {
  constructor(private readonly aggregator: OpenApiAggregatorService) {}

  @Get('routes')
  @ApiOperation({ summary: 'Get all configured gateway routes' })
  routes() {
    return {
      version: 'v1',
      routes: gatewayRoutes.map((route) => ({
        kind: route.kind,
        gatewayPrefix: route.gatewayPrefix,
        upstreamPrefix: route.upstreamPrefix,
        rateLimitPolicy: route.rateLimitPolicy,
        requiresAuth: route.requiresAuth,
        description: route.description,
      })),
    };
  }

  @Get('openapi/upstreams')
  @ApiOperation({ summary: 'Get downstream service OpenAPI endpoints' })
  upstreams() {
    return {
      gateway: '/gateway/openapi/aggregated',
      upstreams: [
        {
          service: 'auth-service',
          openApiJson: '/internal/v1/auth-service/docs-json',
          swaggerUi: '/internal/v1/auth-service/docs',
        },
      ],
    };
  }

  @Get('openapi/aggregated')
  @ApiOperation({ summary: 'Get aggregated OpenAPI JSON' })
  async getAggregated(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === 'true' || refresh === '1';
    return this.aggregator.getAggregatedSpec(forceRefresh);
  }
}
