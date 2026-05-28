export type GatewayRouteKind = 'public' | 'internal' | 'compatibility' | 'websocket';

export type GatewayRateLimitPolicy = 'auth' | 'public' | 'internal' | 'websocket';

export type GatewayRouteConfig = {
  kind: GatewayRouteKind;
  gatewayPrefix: string;
  upstreamPrefix: string;
  targetEnv:
    | 'AUTH_SERVICE_URL'
    | 'AUTH_SERVICE_INTERNAL_URL'
    | 'SCHEDULING_SERVICE_URL'
    | 'SCHEDULING_SERVICE_INTERNAL_URL'
    | 'INTEGRATIONS_SERVICE_URL'
    | 'INTEGRATIONS_SERVICE_INTERNAL_URL'
    | 'ANALYTICS_SERVICE_URL'
    | 'ANALYTICS_SERVICE_INTERNAL_URL'
    | 'BILLING_SERVICE_URL'
    | 'BILLING_SERVICE_INTERNAL_URL';
  rateLimitPolicy: GatewayRateLimitPolicy;
  requiresAuth: boolean;
  description: string;
};

const authTarget = 'AUTH_SERVICE_URL' as const;
const internalTarget = 'AUTH_SERVICE_INTERNAL_URL' as const;
const schedulingTarget = 'SCHEDULING_SERVICE_URL' as const;
const schedulingInternalTarget = 'SCHEDULING_SERVICE_INTERNAL_URL' as const;
const integrationsTarget = 'INTEGRATIONS_SERVICE_URL' as const;
const integrationsInternalTarget = 'INTEGRATIONS_SERVICE_INTERNAL_URL' as const;
const analyticsTarget = 'ANALYTICS_SERVICE_URL' as const;
const analyticsInternalTarget = 'ANALYTICS_SERVICE_INTERNAL_URL' as const;
const billingTarget = 'BILLING_SERVICE_URL' as const;
const billingInternalTarget = 'BILLING_SERVICE_INTERNAL_URL' as const;

const publicDomainPrefixes = [
  ['analytics', '/analytics', true, analyticsTarget],
  ['appointments', '/appointments', true, schedulingTarget],
  ['auth', '/auth', false, authTarget],
  ['availability', '/availability', true, schedulingTarget],
  ['branches', '/branches', true, authTarget],
  ['communications', '/communications', true, authTarget],
  ['departments', '/departments', true, authTarget],
  ['directories', '/directories', true, authTarget],
  ['doctors', '/doctors', true, authTarget],
  ['employees', '/employees', true, authTarget],
  ['emr', '/emr', true, authTarget],
  ['equipment', '/equipment', true, schedulingTarget],
  ['finance', '/finance', true, authTarget],
  ['integration', '/integration', true, integrationsTarget],
  ['inventory', '/inventory', true, authTarget],
  ['online-booking', '/online-booking', true, schedulingTarget],
  ['patients', '/patients', true, authTarget],
  ['reception', '/reception', true, authTarget],
  ['resource-buffers', '/resource-buffers', true, schedulingTarget],
  ['rooms', '/rooms', true, schedulingTarget],
  ['schedules', '/schedules', true, schedulingTarget],
  ['services', '/services', true, authTarget],
  ['slots', '/slots', true, schedulingTarget],
  ['system', '/system', true, authTarget],
  ['waiting-list', '/waiting-list', true, schedulingTarget],
] satisfies Array<[string, string, boolean, GatewayRouteConfig['targetEnv']]>;

export const publicRoutes: GatewayRouteConfig[] = [
  ...publicDomainPrefixes.map(([name, upstreamPrefix, requiresAuth, target]) => ({
    kind: 'public' as GatewayRouteKind,
    gatewayPrefix: `/api/v1/${name}`,
    upstreamPrefix,
    targetEnv: target as GatewayRouteConfig['targetEnv'],
    rateLimitPolicy: (name === 'auth' ? 'auth' : 'public') as GatewayRateLimitPolicy,
    requiresAuth,
    description: `Public v1 proxy for ${upstreamPrefix}`,
  })),
  {
    kind: 'public' as GatewayRouteKind,
    gatewayPrefix: '/api/v1/billing/webhooks',
    upstreamPrefix: '/billing/webhooks',
    targetEnv: billingTarget as GatewayRouteConfig['targetEnv'],
    rateLimitPolicy: 'public' as GatewayRateLimitPolicy,
    requiresAuth: false,
    description: 'Billing microservice public webhooks',
  },
  {
    kind: 'public' as GatewayRouteKind,
    gatewayPrefix: '/api/v1/billing',
    upstreamPrefix: '/billing',
    targetEnv: billingTarget as GatewayRouteConfig['targetEnv'],
    rateLimitPolicy: 'public' as GatewayRateLimitPolicy,
    requiresAuth: true,
    description: 'Billing microservice main endpoints',
  },
];

const compatibilityPrefixes = [
  ['/auth', authTarget],
  ['/patients', authTarget],
  ['/appointments', schedulingTarget],
  ['/availability', schedulingTarget],
  ['/slots', schedulingTarget],
  ['/services', authTarget],
  ['/doctors', authTarget],
  ['/finance', authTarget],
  ['/reception', authTarget],
  ['/waiting-list', schedulingTarget],
  ['/resource-buffers', schedulingTarget],
  ['/online-booking', schedulingTarget],
  ['/rooms', schedulingTarget],
  ['/portal/v1', authTarget],
  ['/fhir', integrationsTarget],
] satisfies Array<[string, GatewayRouteConfig['targetEnv']]>;

export const compatibilityRoutes: GatewayRouteConfig[] = compatibilityPrefixes.map(
  ([prefix, target]) => ({
    kind: 'compatibility',
    gatewayPrefix: prefix,
    upstreamPrefix: prefix,
    targetEnv: target,
    rateLimitPolicy: prefix === '/auth' ? 'auth' : 'public',
    requiresAuth: prefix !== '/auth' && prefix !== '/fhir',
    description: `Backward-compatible unversioned proxy for ${prefix}`,
  }),
);

export const internalRoutes: GatewayRouteConfig[] = [
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/auth',
    upstreamPrefix: '/auth',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: true,
    description: 'Internal auth service contract',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/health/auth-service',
    upstreamPrefix: '/health',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal auth-service health proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/auth-service/docs',
    upstreamPrefix: '/docs',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal auth-service Swagger UI proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/auth-service/docs-json',
    upstreamPrefix: '/docs-json',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal auth-service OpenAPI JSON proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/health/scheduling-service',
    upstreamPrefix: '/health',
    targetEnv: schedulingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal scheduling-service health proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/scheduling-service/docs',
    upstreamPrefix: '/docs',
    targetEnv: schedulingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal scheduling-service Swagger UI proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/scheduling-service/docs-json',
    upstreamPrefix: '/docs-json',
    targetEnv: schedulingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal scheduling-service OpenAPI JSON proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/health/analytics-service',
    upstreamPrefix: '/health',
    targetEnv: analyticsInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal analytics-service health proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/analytics-service/docs',
    upstreamPrefix: '/docs',
    targetEnv: analyticsInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal analytics-service Swagger UI proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/analytics-service/docs-json',
    upstreamPrefix: '/docs-json',
    targetEnv: analyticsInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal analytics-service OpenAPI JSON proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/health/billing-service',
    upstreamPrefix: '/health',
    targetEnv: billingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal billing-service health proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/billing-service/docs',
    upstreamPrefix: '/docs',
    targetEnv: billingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal billing-service Swagger UI proxy',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/billing-service/docs-json',
    upstreamPrefix: '/docs-json',
    targetEnv: billingInternalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal billing-service OpenAPI JSON proxy',
  },
];

export const websocketRoutes: GatewayRouteConfig[] = [
  {
    kind: 'websocket',
    gatewayPrefix: '/socket.io',
    upstreamPrefix: '/socket.io',
    targetEnv: authTarget,
    rateLimitPolicy: 'websocket',
    requiresAuth: true,
    description: 'Socket.IO transport proxy',
  },
  {
    kind: 'websocket',
    gatewayPrefix: '/realtime',
    upstreamPrefix: '/realtime',
    targetEnv: authTarget,
    rateLimitPolicy: 'websocket',
    requiresAuth: true,
    description: 'Direct realtime namespace proxy',
  },
];

export const gatewayRoutes = [
  ...publicRoutes,
  ...compatibilityRoutes,
  ...internalRoutes,
  ...websocketRoutes,
];
