import { BootstrapPayload } from '@/shared/types/bootstrap';

export function can(bootstrap: BootstrapPayload, permission: string): boolean {
  return bootstrap.permissions.includes(permission);
}

export function moduleEnabled(bootstrap: BootstrapPayload, moduleCode: string): boolean {
  return (
    bootstrap.enabledModules.includes(moduleCode) ||
    bootstrap.featureFlags[`${moduleCode}.enabled`] === true
  );
}
