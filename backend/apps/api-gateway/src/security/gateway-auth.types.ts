/**
 * Represents the authenticated user context at the API Gateway level.
 */
export type GatewayPrincipal = {
  userId: string;
  tenantId: string;
  branchIds: string[];
  roles: string[];
  permissions: string[];
  tokenId?: string;
};

/**
 * Supported failure codes when gateway-level authentication fails.
 */
export type GatewayAuthFailureCode =
  | 'AUTH_TOKEN_MISSING'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_TOKEN_EXPIRED'
  | 'TENANT_CONTEXT_MISSING'
  | 'TENANT_MISMATCH';

/**
 * Result of the gateway-level token verification.
 */
export type GatewayAuthResult =
  | { ok: true; principal: GatewayPrincipal }
  | { ok: false; code: GatewayAuthFailureCode; message: string };
