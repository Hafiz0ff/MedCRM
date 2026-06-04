/**
 * Headers that transport downstream authenticated context.
 * These are stripped from the incoming request and only set by the gateway's verified credentials.
 */
export const TRUSTED_IDENTITY_HEADERS = [
  'x-user-id',
  'x-tenant-id',
  'x-branch-id',
  'x-roles',
  'x-permissions',
  'x-tenant-code',
];
