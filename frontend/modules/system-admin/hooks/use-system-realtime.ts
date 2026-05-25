'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { SystemAdminQueryKeys as QK } from './use-system-admin';

type RoleEvent = { roleId?: string };
type UserRolesEvent = { userId?: string };

/**
 * Subscribe to tenant-scoped settings events broadcast by the backend.
 * Each event invalidates the matching TanStack Query cache so the UI
 * refreshes without a manual reload.
 */
export function useSystemAdminRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const onTenantProfile = () => qc.invalidateQueries({ queryKey: QK.tenantProfile });
    const onTenantModule = () => qc.invalidateQueries({ queryKey: QK.modules });
    const onRoleCreated = () => qc.invalidateQueries({ queryKey: QK.roles });
    const onRolePermissions = (payload: RoleEvent) => {
      qc.invalidateQueries({ queryKey: QK.roles });
      qc.invalidateQueries({ queryKey: QK.users });
      if (payload?.roleId) {
        qc.invalidateQueries({ queryKey: ['system', 'user-roles'] });
      }
    };
    const onUserRoles = (payload: UserRolesEvent) => {
      qc.invalidateQueries({ queryKey: QK.users });
      if (payload?.userId) {
        qc.invalidateQueries({ queryKey: QK.userRoles(payload.userId) });
      }
    };
    const onIntegration = () => qc.invalidateQueries({ queryKey: QK.integrations });
    const onIntegrationKey = () => qc.invalidateQueries({ queryKey: QK.integrations });

    socket.on('tenant.profile.updated', onTenantProfile);
    socket.on('tenant.module.updated', onTenantModule);
    socket.on('tenant.role.created', onRoleCreated);
    socket.on('tenant.role.permissions.updated', onRolePermissions);
    socket.on('tenant.user.roles.updated', onUserRoles);
    socket.on('tenant.integration.created', onIntegration);
    socket.on('tenant.integration.updated', onIntegration);
    socket.on('tenant.integration.deleted', onIntegration);
    socket.on('tenant.integration.key.rotated', onIntegrationKey);

    return () => {
      socket.off('tenant.profile.updated', onTenantProfile);
      socket.off('tenant.module.updated', onTenantModule);
      socket.off('tenant.role.created', onRoleCreated);
      socket.off('tenant.role.permissions.updated', onRolePermissions);
      socket.off('tenant.user.roles.updated', onUserRoles);
      socket.off('tenant.integration.created', onIntegration);
      socket.off('tenant.integration.updated', onIntegration);
      socket.off('tenant.integration.deleted', onIntegration);
      socket.off('tenant.integration.key.rotated', onIntegrationKey);
    };
  }, [qc]);
}
