import { z } from 'zod';

export const CreateRoleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[A-Z0-9_]+$/, 'Role code must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});
export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

export const SetRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1).max(160)),
});
export type SetRolePermissionsDto = z.infer<typeof SetRolePermissionsSchema>;

export const AssignUserRolesSchema = z.object({
  assignments: z
    .array(
      z.object({
        branchId: z.string().uuid(),
        roleId: z.string().uuid(),
        isPrimary: z.boolean().optional().default(false),
      }),
    )
    .min(0),
});
export type AssignUserRolesDto = z.infer<typeof AssignUserRolesSchema>;
