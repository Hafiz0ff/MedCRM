import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicRoutes, compatibilityRoutes } from './gateway-route.config';

@Injectable()
export class OpenApiAggregatorService {
  private readonly logger = new Logger(OpenApiAggregatorService.name);
  private cachedSchema: any = null;
  private lastFetchedAt = 0;

  constructor(private readonly config: ConfigService) {}

  async getAggregatedSpec(forceRefresh = false): Promise<any> {
    const now = Date.now();
    if (this.cachedSchema && !forceRefresh && now - this.lastFetchedAt < 300_000) {
      return this.cachedSchema;
    }

    try {
      const authServiceUrl =
        this.config.get<string>('AUTH_SERVICE_INTERNAL_URL') ??
        this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');

      const response = await fetch(`${authServiceUrl}/docs-json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch auth-service OpenAPI spec: ${response.statusText}`);
      }
      const rawSpec = await response.json();

      const aggregatedPaths: any = {};
      const allPrefixRoutes = [...publicRoutes, ...compatibilityRoutes];

      if (rawSpec.paths) {
        for (const [path, pathItem] of Object.entries(rawSpec.paths)) {
          let rewritten = false;
          // Sort routes so that longer upstreamPrefix matches are checked first
          const sortedRoutes = [...allPrefixRoutes].sort(
            (a, b) => b.upstreamPrefix.length - a.upstreamPrefix.length,
          );

          for (const route of sortedRoutes) {
            if (path === route.upstreamPrefix || path.startsWith(route.upstreamPrefix + '/')) {
              const suffix = path.slice(route.upstreamPrefix.length);
              const newPath = `${route.gatewayPrefix}${suffix}`;
              aggregatedPaths[newPath] = pathItem;
              rewritten = true;
              break;
            }
          }

          if (!rewritten) {
            aggregatedPaths[path] = pathItem;
          }
        }
      }

      this.cachedSchema = {
        openapi: rawSpec.openapi || '3.0.0',
        info: {
          title: 'MedCRM Aggregated API Gateway Documentation',
          description:
            'Unified API Documentation for all MedCRM downstream services routed through the API Gateway.',
          version: '1.0.0',
        },
        servers: [
          {
            url: '/',
            description: 'Current Environment Gateway',
          },
        ],
        paths: aggregatedPaths,
        components: rawSpec.components || {},
      };

      this.lastFetchedAt = now;
      return this.cachedSchema;
    } catch (err: any) {
      this.logger.error(`Error aggregating OpenAPI specifications: ${err.message}`);
      if (this.cachedSchema) {
        this.logger.warn('Returning stale OpenAPI schema cache');
        return this.cachedSchema;
      }
      throw err;
    }
  }
}
