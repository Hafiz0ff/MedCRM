export type RateLimitPolicy = 'auth' | 'public' | 'internal' | 'websocket';

export type RateLimitOptions = {
  windowMs: number;
  maxByPolicy: Partial<Record<RateLimitPolicy, number>>;
  failOpenPolicies: RateLimitPolicy[];
  trustedProxyCidrs: string[];
};

export type RateLimitDecision = {
  allowed: boolean;
  policy: RateLimitPolicy;
  limit: number;
  remaining: number;
  resetAt: Date;
};
