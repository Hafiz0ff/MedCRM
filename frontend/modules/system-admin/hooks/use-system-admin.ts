'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client-api';

export type TenantProfile = {
  id: string;
  code: string;
  name: string;
  subscriptionPlan: string;
  defaultLocale: string;
  timezone: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantModule = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  isCore: boolean;
  enabled: boolean;
  activatedAt: string | null;
  configuration: Record<string, unknown>;
};

export type PermissionCatalogEntry = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  moduleCode: string;
  moduleName: string | null;
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  tenantId: string | null;
  permissions: string[];
};

export type TenantUserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: string | null;
  activeAssignmentCount: number;
  primaryRole: string | null;
  branches: Array<{ id: string; code: string; name: string }>;
};

export type UserAssignmentEntry = {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isPrimary: boolean;
  activeFrom: string;
};

export type UserRoleTree = {
  userId: string;
  email: string;
  assignments: UserAssignmentEntry[];
};

export type IntegrationProvider = {
  id: string;
  providerType: string;
  providerCode: string;
  providerName: string;
  authenticationType: string;
  rateLimitPerMinute: number;
  isActive: boolean;
  createdAt: string;
  apiKeyPrefix: string | null;
  configuration: Record<string, unknown>;
};

export type IntegrationCreatedResponse = {
  id: string;
  providerType: string;
  providerCode: string;
  providerName: string;
  authenticationType: string;
  apiKey: string;
  apiKeyPrefix: string;
  issuedAt: string | null;
};

export type IntegrationRotatedResponse = {
  id: string;
  apiKey: string;
  apiKeyPrefix: string;
  rotatedAt: string | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  branchId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
  oldValuesJson: unknown;
  newValuesJson: unknown;
  createdAt: string;
};

export type AuditLogPage = {
  page: number;
  pageSize: number;
  total: number;
  items: AuditLogEntry[];
};

export type AuditFilters = {
  action?: string;
  userId?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

const QK = {
  tenantProfile: ['system', 'tenant'] as const,
  modules: ['system', 'modules'] as const,
  permissions: ['system', 'permissions'] as const,
  roles: ['system', 'roles'] as const,
  users: ['system', 'users'] as const,
  userRoles: (userId: string) => ['system', 'user-roles', userId] as const,
  integrations: ['system', 'integrations'] as const,
  auditLog: (filters: AuditFilters) => ['system', 'audit', filters] as const
};

export const SystemAdminQueryKeys = QK;

// ---------- Tenant profile + modules ----------

export function useTenantProfile() {
  return useQuery({
    queryKey: QK.tenantProfile,
    queryFn: () => apiFetch<TenantProfile>('/system/tenant')
  });
}

export function useUpdateTenantProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<Pick<TenantProfile, 'name' | 'defaultLocale' | 'timezone'>>) =>
      apiFetch<TenantProfile>('/system/tenant', {
        method: 'PATCH',
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tenantProfile });
    }
  });
}

export function useTenantModules() {
  return useQuery({
    queryKey: QK.modules,
    queryFn: () => apiFetch<TenantModule[]>('/system/modules')
  });
}

export function useUpdateTenantModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      moduleCode: string;
      enabled?: boolean;
      configuration?: Record<string, unknown>;
    }) =>
      apiFetch<TenantModule>(`/system/modules/${input.moduleCode}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: input.enabled,
          configuration: input.configuration
        })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.modules });
    }
  });
}

// ---------- Roles + permissions ----------

export function usePermissionCatalog() {
  return useQuery({
    queryKey: QK.permissions,
    queryFn: () => apiFetch<PermissionCatalogEntry[]>('/system/permissions')
  });
}

export function useRoles() {
  return useQuery({
    queryKey: QK.roles,
    queryFn: () => apiFetch<RoleSummary[]>('/system/roles')
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { code: string; name: string; description?: string | null }) =>
      apiFetch<RoleSummary>('/system/roles', {
        method: 'POST',
        body: JSON.stringify(dto)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.roles })
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; name?: string; description?: string | null }) =>
      apiFetch<RoleSummary>(`/system/roles/${input.roleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: input.name, description: input.description })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.roles })
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      apiFetch<{ ok: true }>(`/system/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.roles })
  });
}

export type RolePermissionsUpdated = {
  roleId: string;
  permissions: string[];
  affectedUserCount: number;
  revokedSessionCount: number;
};

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; permissionCodes: string[] }) =>
      apiFetch<RolePermissionsUpdated>(`/system/roles/${input.roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes: input.permissionCodes })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.roles })
  });
}

export function useTenantUsers() {
  return useQuery({
    queryKey: QK.users,
    queryFn: () => apiFetch<TenantUserSummary[]>('/system/users')
  });
}

export function useUserRoles(userId: string | null) {
  return useQuery({
    queryKey: userId ? QK.userRoles(userId) : ['system', 'user-roles', 'none'],
    queryFn: () => apiFetch<UserRoleTree>(`/system/users/${userId}/roles`),
    enabled: Boolean(userId)
  });
}

export type UserRolesUpdated = {
  userId: string;
  assignments: Array<{ branchId: string; roleId: string; isPrimary?: boolean }>;
  revokedSessionCount: number;
};

export function useAssignUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      assignments: Array<{ branchId: string; roleId: string; isPrimary?: boolean }>;
    }) =>
      apiFetch<UserRolesUpdated>(`/system/users/${input.userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ assignments: input.assignments })
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.userRoles(vars.userId) });
      qc.invalidateQueries({ queryKey: QK.roles });
    }
  });
}

// ---------- Integration providers ----------

export function useIntegrationProviders() {
  return useQuery({
    queryKey: QK.integrations,
    queryFn: () => apiFetch<IntegrationProvider[]>('/system/integrations')
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      providerType: string;
      providerCode: string;
      providerName: string;
      authenticationType: string;
      rateLimitPerMinute?: number;
      configuration?: Record<string, unknown>;
    }) =>
      apiFetch<IntegrationCreatedResponse>('/system/integrations', {
        method: 'POST',
        body: JSON.stringify(dto)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.integrations })
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      providerId: string;
      providerName?: string;
      rateLimitPerMinute?: number;
      isActive?: boolean;
      configuration?: Record<string, unknown>;
    }) =>
      apiFetch<IntegrationProvider>(`/system/integrations/${input.providerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          providerName: input.providerName,
          rateLimitPerMinute: input.rateLimitPerMinute,
          isActive: input.isActive,
          configuration: input.configuration
        })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.integrations })
  });
}

export function useRotateIntegrationKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch<IntegrationRotatedResponse>(
        `/system/integrations/${providerId}/rotate-key`,
        { method: 'POST' }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.integrations })
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch<{ ok: true }>(`/system/integrations/${providerId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.integrations })
  });
}

// ---------- Audit log ----------

export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: QK.auditLog(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return apiFetch<AuditLogPage>(`/system/audit-logs${qs ? `?${qs}` : ''}`);
    },
    placeholderData: (prev) => prev
  });
}
