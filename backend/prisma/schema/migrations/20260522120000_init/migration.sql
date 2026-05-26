create extension if not exists "pgcrypto";

create table tenants (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  subscription_plan varchar(80) not null,
  default_locale varchar(10) not null default 'ru',
  timezone varchar(80) not null default 'Europe/Moscow',
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  address text,
  phone varchar(60),
  timezone varchar(80) not null,
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table system_modules (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  module_id uuid not null references system_modules(id),
  enabled boolean not null default false,
  activated_at timestamptz,
  configuration_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_id)
);

create index idx_tenant_modules_tenant_enabled on tenant_modules (tenant_id, enabled);

create table users (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references system_modules(id),
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
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  role_id uuid not null references roles(id),
  is_primary boolean not null default false,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  created_at timestamptz not null default now()
);

create index idx_user_branch_roles_context on user_branch_roles (tenant_id, user_id, branch_id);

create table user_sessions (
  id uuid primary key default gen_random_uuid(),
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

create index idx_user_sessions_tenant_user on user_sessions (tenant_id, user_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  branch_id uuid,
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

create index idx_audit_logs_tenant_action_created on audit_logs (tenant_id, action, created_at);

alter table tenants enable row level security;
alter table branches enable row level security;
alter table users enable row level security;
alter table tenant_modules enable row level security;
alter table user_sessions enable row level security;
alter table audit_logs enable row level security;

create policy tenant_isolation_branches on branches
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_users on users
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_tenant_modules on tenant_modules
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_user_sessions on user_sessions
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_audit_logs on audit_logs
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

