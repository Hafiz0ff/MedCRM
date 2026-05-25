export type GatewayRouteKind = 'public' | 'internal' | 'compatibility' | 'websocket';

export type GatewayRateLimitPolicy = 'auth' | 'public' | 'internal' | 'websocket';

export type GatewayRouteConfig = {
  kind: GatewayRouteKind;
  gatewayPrefix: string;
  upstreamPrefix: string;
  targetEnv: 'AUTH_SERVICE_URL' | 'AUTH_SERVICE_INTERNAL_URL';
  rateLimitPolicy: GatewayRateLimitPolicy;
  requiresAuth: boolean;
  description: string;
};

const authTarget = 'AUTH_SERVICE_URL' as const;
const internalTarget = 'AUTH_SERVICE_INTERNAL_URL' as const;

const publicDomainPrefixes = [
  ['analytics', '/analytics', true],
  ['appointments', '/appointments', true],
  ['auth', '/auth', false],
  ['availability', '/availability', true],
  ['branches', '/branches', true],
  ['communications', '/communications', true],
  ['departments', '/departments', true],
  ['directories', '/directories', true],
  ['doctors', '/doctors', true],
  ['employees', '/employees', true],
  ['emr', '/emr', true],
  ['equipment', '/equipment', true],
  ['finance', '/finance', true],
  ['integration', '/integration', true],
  ['inventory', '/inventory', true],
  ['online-booking', '/online-booking', true],
  ['patients', '/patients', true],
  ['reception', '/reception', true],
  ['resource-buffers', '/resource-buffers', true],
  ['rooms', '/rooms', true],
  ['schedules', '/schedules', true],
  ['services', '/services', true],
  ['slots', '/slots', true],
  ['system', '/system', true],
  ['waiting-list', '/waiting-list', true],
] satisfies Array<[string, string, boolean]>;

export const publicRoutes: GatewayRouteConfig[] = publicDomainPrefixes.map(
  ([name, upstreamPrefix, requiresAuth]) => ({
    kind: 'public',
    gatewayPrefix: `/api/v1/${name}`,
    upstreamPrefix,
    targetEnv: authTarget,
    rateLimitPolicy: name === 'auth' ? 'auth' : 'public',
    requiresAuth,
    description: `Public v1 proxy for ${upstreamPrefix}`,
  }),
);

const compatibilityPrefixes = [
  '/auth',
  '/patients',
  '/appointments',
  '/availability',
  '/slots',
  '/services',
  '/doctors',
  '/finance',
  '/reception',
  '/waiting-list',
  '/resource-buffers',
  '/online-booking',
  '/rooms',
];

export const compatibilityRoutes: GatewayRouteConfig[] = compatibilityPrefixes.map((prefix) => ({
  kind: 'compatibility',
  gatewayPrefix: prefix,
  upstreamPrefix: prefix,
  targetEnv: authTarget,
  rateLimitPolicy: prefix === '/auth' ? 'auth' : 'public',
  requiresAuth: prefix !== '/auth',
  description: `Backward-compatible unversioned proxy for ${prefix}`,
}));

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
