'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can } from '@/shared/permissions/can';
import { useToast } from '@/shared/ui/toast';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  RoleSummary,
  TenantUserSummary,
  UserAssignmentEntry,
  useAssignUserRoles,
  useCreateRole,
  useDeleteRole,
  usePermissionCatalog,
  useRoles,
  useSetRolePermissions,
  useTenantUsers,
  useUserRoles
} from '../hooks/use-system-admin';

type Mode = 'roles' | 'users';

export function RbacTab({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const { toast } = useToast();
  const canManageRoles = can(bootstrap, 'roles.manage');
  const canManageUsers = can(bootstrap, 'users.manage');

  const [mode, setMode] = useState<Mode>('roles');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const rolesQuery = useRoles();
  const usersQuery = useTenantUsers();
  const permissionsQuery = usePermissionCatalog();

  if (rolesQuery.isLoading || permissionsQuery.isLoading || usersQuery.isLoading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spin" size={18} />
        <span>Загружаем ролевую модель…</span>
      </div>
    );
  }

  if (rolesQuery.error) {
    return <div className="error">Не удалось загрузить роли: {rolesQuery.error.message}</div>;
  }

  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  return (
    <div className="rbac-layout">
      <aside className="rbac-side">
        <div className="rbac-side-switch" role="tablist">
          <button
            type="button"
            className={`settings-pill-tab${mode === 'roles' ? ' is-active' : ''}`}
            onClick={() => setMode('roles')}
          >
            <ShieldCheck size={14} /> Роли ({roles.length})
          </button>
          <button
            type="button"
            className={`settings-pill-tab${mode === 'users' ? ' is-active' : ''}`}
            onClick={() => setMode('users')}
          >
            <Users size={14} /> Сотрудники ({users.length})
          </button>
        </div>

        {mode === 'roles' ? (
          <RolesList
            roles={roles}
            selectedRoleId={selectedRoleId}
            onSelect={setSelectedRoleId}
            canManage={canManageRoles}
            onCreated={(role) => {
              toast('success', 'Роль создана', role.name);
              setSelectedRoleId(role.id);
            }}
            onError={(msg) => toast('error', 'Ошибка', msg)}
          />
        ) : (
          <UsersList
            users={users}
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />
        )}
      </aside>

      <div className="rbac-detail">
        {mode === 'roles' ? (
          <RoleEditor
            role={roles.find((r) => r.id === selectedRoleId) ?? null}
            permissions={permissions}
            canManage={canManageRoles}
            onClose={() => setSelectedRoleId(null)}
          />
        ) : (
          <UserEditor
            user={users.find((u) => u.id === selectedUserId) ?? null}
            roles={roles}
            bootstrap={bootstrap}
            canManage={canManageUsers}
            onClose={() => setSelectedUserId(null)}
          />
        )}
      </div>
    </div>
  );
}

function RolesList({
  roles,
  selectedRoleId,
  onSelect,
  canManage,
  onCreated,
  onError
}: {
  roles: RoleSummary[];
  selectedRoleId: string | null;
  onSelect: (id: string) => void;
  canManage: boolean;
  onCreated: (role: RoleSummary) => void;
  onError: (message: string) => void;
}) {
  const createRole = useCreateRole();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createRole.mutate(
      { code: code.trim().toUpperCase(), name: name.trim(), description: description.trim() || null },
      {
        onSuccess: (created) => {
          setShowForm(false);
          setCode('');
          setName('');
          setDescription('');
          onCreated(created);
        },
        onError: (err) => onError(err.message)
      }
    );
  };

  return (
    <div className="rbac-list">
      <div className="rbac-list-header">
        <span className="eyebrow">Каталог ролей</span>
        {canManage ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => setShowForm((value) => !value)}
            title="Создать роль"
          >
            <Plus size={14} /> Новая
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form className="rbac-create-form form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="role-code">Код (UPPER_SNAKE)</label>
            <input
              id="role-code"
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              pattern="[A-Z0-9_]{2,}"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role-name">Название</label>
            <input
              id="role-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role-desc">Описание (опц.)</label>
            <input
              id="role-desc"
              className="input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
            <button type="submit" className="button" disabled={createRole.isPending}>
              {createRole.isPending ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="rbac-list-items">
        {roles.map((role) => (
          <li key={role.id}>
            <button
              type="button"
              className={`rbac-row${role.id === selectedRoleId ? ' is-active' : ''}`}
              onClick={() => onSelect(role.id)}
            >
              <div>
                <strong>{role.name}</strong>
                <small className="muted">
                  <code>{role.code}</code>
                  {role.isSystem ? <span className="settings-pill is-info">system</span> : null}
                  <span className="muted">{role.permissions.length} прав</span>
                </small>
              </div>
              <ChevronRight size={16} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleEditor({
  role,
  permissions,
  canManage,
  onClose
}: {
  role: RoleSummary | null;
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    moduleCode: string;
    moduleName: string | null;
  }>;
  canManage: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const setPermissions = useSetRolePermissions();
  const deleteRole = useDeleteRole();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setSelected(new Set(role?.permissions ?? []));
  }, [role?.id, role?.permissions]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const perm of permissions) {
      if (!map.has(perm.moduleCode)) map.set(perm.moduleCode, []);
      map.get(perm.moduleCode)?.push(perm);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  if (!role) {
    return (
      <div className="rbac-empty">
        <ShieldCheck size={32} className="muted" />
        <p>Выберите роль слева, чтобы посмотреть и отредактировать её матрицу прав.</p>
      </div>
    );
  }

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleGroup = (codes: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = codes.every((code) => next.has(code));
      for (const code of codes) {
        if (allSelected) next.delete(code);
        else next.add(code);
      }
      return next;
    });
  };

  const handleSave = () => {
    setPermissions.mutate(
      { roleId: role.id, permissionCodes: Array.from(selected) },
      {
        onSuccess: (result) =>
          toast(
            'success',
            'Права обновлены',
            result.revokedSessionCount > 0
              ? `Сессии затронутых сотрудников (${result.revokedSessionCount}) принудительно сброшены`
              : 'Изменения сохранены'
          ),
        onError: (err) => toast('error', 'Не удалось сохранить', err.message)
      }
    );
  };

  const handleDelete = () => {
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        toast('success', 'Роль удалена', role.name);
        setConfirmDelete(false);
        onClose();
      },
      onError: (err) => {
        toast('error', 'Невозможно удалить', err.message);
        setConfirmDelete(false);
      }
    });
  };

  const canEdit = canManage && !role.isSystem;
  const dirty =
    canEdit &&
    (selected.size !== role.permissions.length ||
      Array.from(selected).some((code) => !role.permissions.includes(code)));

  return (
    <div className="content-panel rbac-editor">
      <div className="panel-header">
        <div>
          <h2>
            {role.name}
            {role.isSystem ? <span className="settings-pill is-info">system</span> : null}
          </h2>
          <p className="muted">
            <code>{role.code}</code>
            {role.description ? ` · ${role.description}` : ''}
          </p>
        </div>
        <div className="page-actions">
          {canEdit ? (
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteRole.isPending}
            >
              <Trash2 size={14} /> Удалить
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>
      </div>

      {role.isSystem ? (
        <div className="settings-callout">
          <Lock size={14} /> Системную роль нельзя редактировать. Создайте копию, если нужны изменения.
        </div>
      ) : null}

      <div className="rbac-permission-grid">
        {grouped.map(([moduleCode, perms]) => {
          const codes = perms.map((p) => p.code);
          const allSelected = codes.every((code) => selected.has(code));
          const moduleName = perms[0]?.moduleName ?? moduleCode;
          return (
            <section key={moduleCode} className="rbac-permission-group">
              <header>
                <button
                  type="button"
                  className="settings-pill-tab"
                  onClick={() => toggleGroup(codes)}
                  disabled={!canEdit}
                  aria-pressed={allSelected}
                >
                  <span className={`settings-checkbox${allSelected ? ' is-on' : ''}`} aria-hidden="true" />
                  {moduleName}
                  <small className="muted">
                    {codes.filter((c) => selected.has(c)).length}/{codes.length}
                  </small>
                </button>
              </header>
              <ul>
                {perms.map((perm) => (
                  <li key={perm.id}>
                    <label className="rbac-permission">
                      <input
                        type="checkbox"
                        checked={selected.has(perm.code)}
                        onChange={() => toggle(perm.code)}
                        disabled={!canEdit}
                      />
                      <span className="rbac-permission-body">
                        <strong>{perm.name}</strong>
                        <code className="muted">{perm.code}</code>
                        {perm.description ? <small className="muted">{perm.description}</small> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="rbac-editor-footer">
        <span className="muted">
          Выбрано {selected.size} прав из {permissions.length}
        </span>
        <button
          type="button"
          className="button"
          onClick={handleSave}
          disabled={!canEdit || !dirty || setPermissions.isPending}
        >
          {setPermissions.isPending ? 'Сохраняем…' : 'Сохранить и применить'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Удалить роль ${role.name}?`}
        message="Действие нельзя отменить. Перед удалением убедитесь, что у роли нет активных назначений."
        variant="danger"
        confirmLabel="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function UsersList({
  users,
  selectedUserId,
  onSelect
}: {
  users: TenantUserSummary[];
  selectedUserId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = users.filter((user) => {
    const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="rbac-list">
      <div className="rbac-list-header">
        <span className="eyebrow">Сотрудники тенанта</span>
      </div>
      <input
        className="input"
        placeholder="Поиск по имени или email"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul className="rbac-list-items">
        {filtered.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              className={`rbac-row${user.id === selectedUserId ? ' is-active' : ''}`}
              onClick={() => onSelect(user.id)}
            >
              <div>
                <strong>
                  {user.lastName} {user.firstName}
                </strong>
                <small className="muted">
                  {user.email}
                  {user.primaryRole ? <span className="settings-pill is-info">{user.primaryRole}</span> : null}
                  <span className="muted">{user.activeAssignmentCount} назначений</span>
                </small>
              </div>
              <ChevronRight size={16} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type DraftAssignment = {
  key: string;
  branchId: string;
  roleId: string;
  isPrimary: boolean;
};

function UserEditor({
  user,
  roles,
  bootstrap,
  canManage,
  onClose
}: {
  user: TenantUserSummary | null;
  roles: RoleSummary[];
  bootstrap: BootstrapPayload;
  canManage: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const userRolesQuery = useUserRoles(user?.id ?? null);
  const assignRoles = useAssignUserRoles();
  const [draft, setDraft] = useState<DraftAssignment[]>([]);

  useEffect(() => {
    const incoming: UserAssignmentEntry[] = userRolesQuery.data?.assignments ?? [];
    setDraft(
      incoming.map((entry, index) => ({
        key: `${entry.id}-${index}`,
        branchId: entry.branchId,
        roleId: entry.roleId,
        isPrimary: entry.isPrimary
      }))
    );
  }, [userRolesQuery.data]);

  if (!user) {
    return (
      <div className="rbac-empty">
        <Users size={32} className="muted" />
        <p>Выберите сотрудника, чтобы посмотреть его роли и переназначить доступ.</p>
      </div>
    );
  }

  const branches = bootstrap.branches;
  const dirty = JSON.stringify(draft.map(({ branchId, roleId, isPrimary }) => ({ branchId, roleId, isPrimary }))) !==
    JSON.stringify(
      (userRolesQuery.data?.assignments ?? []).map((a) => ({
        branchId: a.branchId,
        roleId: a.roleId,
        isPrimary: a.isPrimary
      }))
    );

  const addRow = () => {
    setDraft((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        branchId: branches[0]?.id ?? '',
        roleId: roles.find((r) => !r.isSystem)?.id ?? roles[0]?.id ?? '',
        isPrimary: prev.length === 0
      }
    ]);
  };

  const removeRow = (key: string) => {
    setDraft((prev) => prev.filter((row) => row.key !== key));
  };

  const updateRow = (key: string, patch: Partial<DraftAssignment>) => {
    setDraft((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleSave = () => {
    assignRoles.mutate(
      {
        userId: user.id,
        assignments: draft.map(({ branchId, roleId, isPrimary }) => ({ branchId, roleId, isPrimary }))
      },
      {
        onSuccess: (result) =>
          toast(
            'success',
            'Роли обновлены',
            result.revokedSessionCount > 0
              ? `Сессии сотрудника (${result.revokedSessionCount}) принудительно сброшены`
              : 'Изменения сохранены'
          ),
        onError: (err) => toast('error', 'Не удалось сохранить', err.message)
      }
    );
  };

  return (
    <div className="content-panel rbac-editor">
      <div className="panel-header">
        <div>
          <h2>
            {user.lastName} {user.firstName}
          </h2>
          <p className="muted">{user.email}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>
      </div>

      {userRolesQuery.isLoading ? (
        <div className="settings-loading">
          <Loader2 className="spin" size={16} /> <span>Загружаем назначения…</span>
        </div>
      ) : (
        <>
          <div className="rbac-assign-list">
            {draft.length === 0 ? (
              <p className="muted">У сотрудника нет активных ролей.</p>
            ) : (
              draft.map((row) => (
                <div className="rbac-assign-row" key={row.key}>
                  <select
                    className="input"
                    value={row.branchId}
                    onChange={(event) => updateRow(row.key, { branchId: event.target.value })}
                    disabled={!canManage}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={row.roleId}
                    onChange={(event) => updateRow(row.key, { roleId: event.target.value })}
                    disabled={!canManage}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <label className="rbac-primary-toggle">
                    <input
                      type="checkbox"
                      checked={row.isPrimary}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? { ...r, isPrimary: event.target.checked }
                              : event.target.checked
                              ? { ...r, isPrimary: false }
                              : r
                          )
                        )
                      }
                      disabled={!canManage}
                    />
                    <span>Основная</span>
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeRow(row.key)}
                    disabled={!canManage}
                    aria-label="Удалить назначение"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rbac-editor-footer">
            <button type="button" className="secondary-button" onClick={addRow} disabled={!canManage}>
              <Plus size={14} /> Добавить назначение
            </button>
            <button
              type="button"
              className="button"
              onClick={handleSave}
              disabled={!canManage || !dirty || assignRoles.isPending}
            >
              {assignRoles.isPending ? 'Применяем…' : 'Сохранить и сбросить сессии'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
