# ТЗ №2. Auth, RBAC и Branch-level permissions

## 1. Назначение

Auth/RBAC подсистема MedCRM обеспечивает централизованную аутентификацию, авторизацию, multi-tenant доступ, управление сессиями, audit logging и branch-level permissions для SaaS CRM/МИС платформы.

Система проектируется как отдельный `auth-service`, интегрированный с API Gateway, core tenancy, module registry, feature flags и audit subsystem.

## 2. Компоненты auth-service

```text
auth-service
  |
  |-- Authentication Engine
  |-- Authorization Engine
  |-- RBAC Engine
  |-- Permission Resolution Engine
  |-- Session Manager
  |-- Token Manager
  |-- 2FA Manager
  |-- Password Policy Manager
  |-- Audit Logger
  |-- OAuth/SSO Adapters
```

| Компонент                    | Ответственность                                          |
| ---------------------------- | -------------------------------------------------------- |
| Authentication Engine        | Login, password verification, user status checks         |
| Authorization Engine         | Проверка tenant, branch, module и permission access      |
| RBAC Engine                  | Роли, permissions, branch-level role assignments         |
| Permission Resolution Engine | Итоговый permissions context для пользователя            |
| Session Manager              | Stateful session records, refresh token rotation, revoke |
| Token Manager                | JWT access token, refresh token hash/fingerprint         |
| 2FA Manager                  | TOTP, Email OTP, future Telegram OTP                     |
| Password Policy Manager      | Argon2id, complexity, history, lockouts                  |
| Audit Logger                 | Append-only события безопасности                         |
| OAuth/SSO Adapters           | Google, Microsoft, LDAP/AD, SAML-ready contracts         |

## 3. Login flow

```text
1. User submits login/email + password.
2. API Gateway resolves tenant context.
3. Authentication Engine loads user by tenant + login/email.
4. Password Policy Manager verifies Argon2id hash.
5. Auth checks user status, tenant status and branch access.
6. 2FA Manager verifies required second factor.
7. RBAC Engine builds branch-aware permissions context.
8. Token Manager issues access_token and refresh_token.
9. Session Manager creates user_sessions record.
10. Redis stores session metadata, token fingerprint and revoke status.
11. Audit Logger writes auth.login.success.
12. Client receives JWT access token and HTTP-only refresh cookie.
```

Failed login attempts must write `auth.login.failed`, increment brute-force counters and apply rate limiting or temporary lockout when thresholds are reached.

## 4. JWT стратегия

### Access token

TTL: **15 минут**.

Claims:

```json
{
  "sub": "user_id",
  "tenant_id": "tenant_uuid",
  "branch_ids": ["branch_uuid"],
  "role_ids": ["role_uuid"],
  "permissions": ["patients.read", "schedule.manage"],
  "session_id": "session_uuid",
  "iat": 0,
  "exp": 0
}
```

### Refresh token

TTL: **30 дней**.

Требования:

- хранится у клиента только как HTTP-only secure cookie;
- в БД хранится только `refresh_token_hash`;
- rotation enabled на каждый refresh;
- revoke support;
- device tracking;
- fingerprint check через Redis/session metadata.

## 5. Stateful sessions + JWT hybrid

Access token остается stateless для быстрых проверок, но каждый защищенный запрос дополнительно валидирует активность `session_id` через Redis или БД fallback.

Таблица `user_sessions`:

| Поле               | Тип         | Обязательность | Комментарий                         |
| ------------------ | ----------- | -------------- | ----------------------------------- |
| id                 | uuid        | Да             | Primary key                         |
| user_id            | uuid        | Да             | FK на `users`                       |
| tenant_id          | uuid        | Да             | FK на `tenants`                     |
| refresh_token_hash | text        | Да             | Hash refresh token                  |
| ip_address         | inet        | Нет            | Последний IP                        |
| user_agent         | text        | Нет            | User-Agent                          |
| device_name        | varchar     | Нет            | Название устройства                 |
| token_fingerprint  | varchar     | Да             | Fingerprint для Redis/session check |
| last_activity_at   | timestamptz | Да             | Последняя активность                |
| expires_at         | timestamptz | Да             | Истечение refresh token             |
| revoked_at         | timestamptz | Нет            | Отзыв сессии                        |
| created_at         | timestamptz | Да             | Дата создания                       |

Redis keys:

```text
session:{session_id}:metadata
session:{session_id}:revoked
session:{session_id}:fingerprint
auth:login-attempts:{tenant_id}:{login}:{ip}
```

## 6. Password security

Hash algorithm: **Argon2id**.

Минимальная policy:

- min 10 chars;
- uppercase required;
- lowercase required;
- number required;
- special char required;
- password history;
- brute-force protection;
- rate limiting;
- temporary lockouts.

Password history хранит hash предыдущих паролей и не допускает повторное использование последних N значений.

## 7. 2FA архитектура

Поддерживаемые методы:

- TOTP;
- Email OTP;
- Telegram OTP, future-ready.

Таблица `user_2fa_settings`:

| Поле             | Тип         | Обязательность | Комментарий                         |
| ---------------- | ----------- | -------------- | ----------------------------------- |
| user_id          | uuid        | Да             | PK/FK на `users`                    |
| is_enabled       | boolean     | Да             | Включена ли 2FA                     |
| secret_hash      | text        | Нет            | Hash/encrypted secret               |
| backup_codes     | jsonb       | Да             | Hash backup codes                   |
| preferred_method | varchar     | Да             | `totp`, `email_otp`, `telegram_otp` |
| created_at       | timestamptz | Да             | Дата создания                       |
| updated_at       | timestamptz | Да             | Дата обновления                     |

## 8. Multi-tenant user model

Пользователь принадлежит tenant-у и может иметь разные роли в разных филиалах одного tenant-а.

Медицинский сценарий:

```text
Иванов И.И.

Филиал №1:
  role: DOCTOR

Филиал №2:
  role: HEAD_DOCTOR

Result:
  permissions context рассчитывается динамически по branch_id.
```

## 9. RBAC таблицы

### `users`

| Поле           | Тип         | Обязательность |
| -------------- | ----------- | -------------- |
| id             | uuid        | Да             |
| tenant_id      | uuid        | Да             |
| email          | varchar     | Да             |
| phone          | varchar     | Нет            |
| password_hash  | text        | Да             |
| first_name     | varchar     | Да             |
| last_name      | varchar     | Да             |
| language       | varchar     | Да             |
| status         | varchar     | Да             |
| is_super_admin | boolean     | Да             |
| last_login_at  | timestamptz | Нет            |
| created_at     | timestamptz | Да             |
| updated_at     | timestamptz | Да             |

### `branches`

| Поле      | Тип     | Обязательность |
| --------- | ------- | -------------- |
| id        | uuid    | Да             |
| tenant_id | uuid    | Да             |
| name      | varchar | Да             |
| code      | varchar | Да             |
| timezone  | varchar | Да             |
| address   | text    | Нет            |
| status    | varchar | Да             |

### `roles`

| Поле        | Тип         | Обязательность              |
| ----------- | ----------- | --------------------------- |
| id          | uuid        | Да                          |
| tenant_id   | uuid        | Нет для global system roles |
| code        | varchar     | Да                          |
| name        | varchar     | Да                          |
| description | text        | Нет                         |
| is_system   | boolean     | Да                          |
| created_at  | timestamptz | Да                          |

Базовые роли:

- `SUPER_ADMIN`;
- `CLINIC_OWNER`;
- `DIRECTOR`;
- `HEAD_DOCTOR`;
- `DOCTOR`;
- `REGISTRAR`;
- `CASHIER`;
- `LAB_OPERATOR`.

### `permissions`

| Поле        | Тип     | Обязательность |
| ----------- | ------- | -------------- |
| id          | uuid    | Да             |
| module_code | varchar | Да             |
| code        | varchar | Да             |
| name        | varchar | Да             |
| description | text    | Нет            |

Примеры:

- `patients.read`;
- `patients.create`;
- `patients.update`;
- `finance.view`;
- `finance.edit`;
- `schedule.manage`.

### `role_permissions`

| Поле          | Тип  | Обязательность |
| ------------- | ---- | -------------- |
| role_id       | uuid | Да             |
| permission_id | uuid | Да             |

Primary key: `(role_id, permission_id)`.

### `user_branch_roles`

Ключевая таблица медицинской специфики. Позволяет назначать разные роли по филиалам и ограничивать доступ к данным филиалов.

| Поле        | Тип         | Обязательность |
| ----------- | ----------- | -------------- |
| id          | uuid        | Да             |
| user_id     | uuid        | Да             |
| tenant_id   | uuid        | Да             |
| branch_id   | uuid        | Да             |
| role_id     | uuid        | Да             |
| is_primary  | boolean     | Да             |
| active_from | timestamptz | Да             |
| active_to   | timestamptz | Нет            |

## 10. SQL baseline

```sql
create table branches (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name varchar(255) not null,
  code varchar(120) not null,
  timezone varchar(80) not null,
  address text,
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table users (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  email varchar(255) not null,
  phone varchar(60),
  password_hash text not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  language varchar(10) not null default 'ru',
  status varchar(40) not null default 'active',
  is_super_admin boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table roles (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table permissions (
  id uuid primary key,
  module_code varchar(120) not null,
  code varchar(160) not null unique,
  name varchar(255) not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  primary key (role_id, permission_id)
);

create table user_branch_roles (
  id uuid primary key,
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  role_id uuid not null references roles(id),
  is_primary boolean not null default false,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  created_at timestamptz not null default now()
);

create index idx_user_branch_roles_context
  on user_branch_roles (tenant_id, user_id, branch_id);

create table user_sessions (
  id uuid primary key,
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  refresh_token_hash text not null,
  ip_address inet,
  user_agent text,
  device_name varchar(255),
  token_fingerprint varchar(255) not null,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table user_2fa_settings (
  user_id uuid primary key references users(id),
  is_enabled boolean not null default false,
  secret_hash text,
  backup_codes jsonb not null default '[]'::jsonb,
  preferred_method varchar(40) not null default 'totp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 11. Authorization middleware

Каждый защищенный запрос проходит pipeline:

```text
1. Validate JWT signature and exp.
2. Validate session_id status.
3. Resolve tenant context.
4. Check tenant status.
5. Resolve requested branch context.
6. Check user branch access.
7. Check enabled module access.
8. Resolve permissions context.
9. Check required permissions.
10. Write audit event when needed.
```

## 12. Permission Resolution Engine

Источники permissions:

- role permissions;
- branch overrides;
- user overrides;
- active module access;
- subscription plan;
- tenant feature flags.

Приоритет:

```text
explicit deny user_override
  > explicit allow user_override
  > branch_override
  > role permission
  > default deny
```

Даже при наличии permission доступ запрещается, если модуль отключен в `tenant_modules` или feature flag выключен.

## 13. Audit log

Audit subsystem фиксирует:

- login;
- logout;
- failed login;
- password change;
- role changes;
- permission changes;
- access denied;
- suspicious activity;
- token revoke;
- data export.

Таблица `audit_logs`:

| Поле            | Тип         | Обязательность |
| --------------- | ----------- | -------------- |
| id              | uuid        | Да             |
| tenant_id       | uuid        | Да             |
| branch_id       | uuid        | Нет            |
| user_id         | uuid        | Нет            |
| action          | varchar     | Да             |
| entity_type     | varchar     | Нет            |
| entity_id       | uuid        | Нет            |
| old_values_json | jsonb       | Нет            |
| new_values_json | jsonb       | Нет            |
| ip_address      | inet        | Нет            |
| user_agent      | text        | Нет            |
| request_id      | varchar     | Да             |
| created_at      | timestamptz | Да             |

```sql
create table audit_logs (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid references branches(id),
  user_id uuid references users(id),
  action varchar(160) not null,
  entity_type varchar(120),
  entity_id uuid,
  old_values_json jsonb,
  new_values_json jsonb,
  ip_address inet,
  user_agent text,
  request_id varchar(160) not null,
  created_at timestamptz not null default now()
);
```

Audit log security:

- append-only strategy;
- immutable records;
- soft-delete prohibited;
- encryption at rest;
- export support;
- read access only for privileged roles;
- all audit reads are audited.

Примеры событий:

- `auth.login.success`;
- `auth.login.failed`;
- `auth.logout`;
- `auth.password.changed`;
- `auth.token.revoked`;
- `user.role.assigned`;
- `permission.updated`;
- `access.denied`;
- `patient.exported`.

## 14. RLS и branch filtering

Tenant-owned таблицы используют PostgreSQL RLS:

```sql
alter table users enable row level security;
alter table branches enable row level security;
alter table user_sessions enable row level security;
alter table audit_logs enable row level security;

create policy tenant_isolation_users
  on users
  using (tenant_id = current_setting('app.current_tenant_id')::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Branch-owned медицинские таблицы должны дополнительно фильтроваться по allowed branches:

```sql
create policy tenant_branch_isolation_appointments
  on appointments
  using (
    tenant_id = current_setting('app.current_tenant_id')::uuid
    and branch_id = any (
      string_to_array(current_setting('app.allowed_branch_ids'), ',')::uuid[]
    )
  )
  with check (
    tenant_id = current_setting('app.current_tenant_id')::uuid
    and branch_id = any (
      string_to_array(current_setting('app.allowed_branch_ids'), ',')::uuid[]
    )
  );
```

Backend обязан устанавливать DB context внутри транзакции:

```sql
select set_config('app.current_tenant_id', '<tenant_uuid>', true);
select set_config('app.allowed_branch_ids', '<branch_uuid_1,branch_uuid_2>', true);
```

## 15. API security

Обязательные middleware и policies:

- Helmet;
- CSRF protection для cookie-based flows;
- строгий CORS allowlist;
- rate limiting;
- request fingerprinting;
- IP throttling;
- brute-force protection;
- request ID/correlation ID;
- secure cookies;
- SameSite policy;
- secrets from secret manager.

## 16. OAuth/SSO-ready архитектура

Поддерживаемые future adapters:

- Google OAuth;
- Microsoft OAuth;
- LDAP/AD;
- SAML SSO.

Контракт identity provider:

```ts
export interface IdentityProviderAdapter {
  code: string;
  authenticate(input: unknown): Promise<ExternalIdentity>;
  mapToUser(identity: ExternalIdentity): Promise<UserIdentityMapping>;
}
```

OAuth/SSO не должен обходить:

- tenant status check;
- user status check;
- branch access check;
- 2FA policy, если включена на tenant/user уровне;
- audit logging.

## 17. Realtime security

Socket.IO handshake:

```text
1. Validate JWT.
2. Validate session_id.
3. Resolve tenant_id.
4. Load allowed branches.
5. Join rooms:
   tenant:{tenant_id}
   tenant:{tenant_id}:branch:{branch_id}
   tenant:{tenant_id}:user:{user_id}
6. Reject events outside tenant/branch scope.
```

Room isolation by `tenant_id` is mandatory.

## 18. Compliance baseline

Архитектура должна учитывать:

- OWASP Top 10;
- HIPAA-ready architecture;
- GDPR-ready principles;
- local data protection compliance;
- принцип минимальных привилегий;
- data export audit;
- медицинские данные как high-sensitivity data class.
