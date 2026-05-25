# Модульность, Multi-tenancy и DB модель

## 1. Основные сущности

```text
tenants
  1 ── * tenant_modules * ── 1 system_modules

tenants
  1 ── * users
  1 ── * roles
  1 ── * feature_flag_values
  1 ── * audit_events
```

## 2. Таблица `system_modules`

Назначение: глобальный реестр модулей платформы.

| Поле         | Тип         | Обязательность | Комментарий                        |
| ------------ | ----------- | -------------- | ---------------------------------- |
| id           | uuid        | Да             | Primary key                        |
| code         | varchar     | Да             | Уникальный код: `patient-crm`      |
| name         | varchar     | Да             | Человекочитаемое имя               |
| version      | varchar     | Да             | SemVer                             |
| is_core      | boolean     | Да             | Core-модуль нельзя отключить       |
| dependencies | jsonb       | Да             | Список кодов зависимостей          |
| status       | varchar     | Да             | `active`, `deprecated`, `disabled` |
| created_at   | timestamptz | Да             | Дата создания                      |
| updated_at   | timestamptz | Да             | Дата обновления                    |

## 3. Таблица `tenant_modules`

Назначение: подключение модулей к конкретной клинике.

| Поле               | Тип         | Обязательность | Комментарий            |
| ------------------ | ----------- | -------------- | ---------------------- |
| id                 | uuid        | Да             | Primary key            |
| tenant_id          | uuid        | Да             | FK на `tenants`        |
| module_id          | uuid        | Да             | FK на `system_modules` |
| enabled            | boolean     | Да             | Включен ли модуль      |
| activated_at       | timestamptz | Нет            | Дата активации         |
| configuration_json | jsonb       | Да             | Конфигурация модуля    |
| created_at         | timestamptz | Да             | Дата создания          |
| updated_at         | timestamptz | Да             | Дата обновления        |

Ограничение: `unique(tenant_id, module_id)`.

## 4. Базовая SQL-схема

```sql
create table tenants (
  id uuid primary key,
  code varchar(120) not null unique,
  name varchar(255) not null,
  subscription_plan varchar(80) not null,
  default_locale varchar(10) not null default 'ru',
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table system_modules (
  id uuid primary key,
  code varchar(120) not null unique,
  name varchar(255) not null,
  version varchar(40) not null,
  is_core boolean not null default false,
  dependencies jsonb not null default '[]'::jsonb,
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_modules (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  module_id uuid not null references system_modules(id),
  enabled boolean not null default false,
  activated_at timestamptz,
  configuration_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_id)
);

create index idx_tenant_modules_tenant_enabled
  on tenant_modules (tenant_id, enabled);
```

## 5. Feature flag таблицы

```sql
create table feature_flags (
  id uuid primary key,
  key varchar(160) not null unique,
  description text,
  value_type varchar(40) not null,
  default_value jsonb not null,
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_feature_flag_values (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  feature_flag_id uuid not null references feature_flags(id),
  value jsonb not null,
  rollout_strategy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature_flag_id)
);
```

## 6. Tenant-owned table contract

Каждая бизнес-таблица, принадлежащая клинике, должна следовать контракту:

```sql
tenant_id uuid not null references tenants(id),
created_by uuid,
updated_by uuid,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
deleted_at timestamptz
```

## 7. PostgreSQL RLS pattern

```sql
alter table patients enable row level security;

create policy tenant_isolation_patients
  on patients
  using (tenant_id = current_setting('app.current_tenant_id')::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Backend перед каждым запросом внутри транзакции устанавливает:

```sql
select set_config('app.current_tenant_id', '<tenant_uuid>', true);
```

## 8. Module enablement algorithm

```text
Input: tenant_id, requested_module_code, user_id, action

1. Resolve tenant context.
2. Load module by code from system_modules.
3. If module is core and active, continue.
4. Check tenant_modules where enabled = true.
5. Resolve dependencies recursively.
6. Build permission map for user roles.
7. Check requested action permission.
8. Evaluate feature flag constraints.
9. Allow or deny request.
```

## 9. Dependency rules

- Core modules могут быть зависимостями обычных модулей.
- Обычный модуль не может включиться, если выключена его обязательная зависимость.
- Отключение модуля должно проверять dependent modules.
- Миграции модуля применяются до активации модуля tenant-у.
- Конфигурация модуля хранится в `tenant_modules.configuration_json` и валидируется Zod schema на backend.

## 10. Audit-ready события

Минимальные audit events:

- `tenant.created`;
- `tenant.updated`;
- `module.enabled`;
- `module.disabled`;
- `feature_flag.changed`;
- `role.changed`;
- `permission.changed`;
- `user.login`;
- `user.logout`;
- `user.2fa.enabled`;
- `patient.accessed`;
- `document.downloaded`.
