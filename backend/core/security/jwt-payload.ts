export type JwtAccessPayload = {
  sub: string;
  tenant_id: string;
  branch_ids: string[];
  role_ids: string[];
  permissions: string[];
  session_id: string;
};

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  branchIds: string[];
  roleIds: string[];
  permissions: string[];
  sessionId: string;
};
