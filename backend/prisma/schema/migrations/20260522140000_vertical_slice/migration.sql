create table patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  external_id varchar(160),
  patient_code varchar(120) not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  middle_name varchar(120),
  full_name varchar(380) not null,
  birth_date date,
  gender varchar(40),
  language varchar(10) not null default 'ru',
  status varchar(40) not null default 'NEW',
  registration_branch_id uuid references branches(id),
  assigned_manager_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, patient_code)
);

create index idx_patients_tenant_full_name on patients (tenant_id, full_name);
create index idx_patients_tenant_branch on patients (tenant_id, registration_branch_id);

create table patient_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  type varchar(40) not null,
  value text not null,
  normalized_value_hash varchar(160) not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patient_contacts_hash on patient_contacts (tenant_id, type, normalized_value_hash);

create table services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  duration_minutes integer not null,
  requires_room boolean not null default false,
  requires_equipment boolean not null default false,
  color varchar(40),
  is_online_bookable boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  patient_id uuid not null references patients(id),
  employee_id uuid not null,
  service_id uuid references services(id),
  appointment_number varchar(120) not null,
  booking_source varchar(60) not null,
  appointment_type varchar(60) not null,
  status varchar(40) not null default 'SCHEDULED',
  priority varchar(40) not null default 'NORMAL',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer not null,
  notes text,
  cancellation_reason text,
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, appointment_number),
  check (end_at > start_at)
);

create index idx_appointments_calendar on appointments (tenant_id, branch_id, start_at, end_at);
create index idx_appointments_employee_overlap on appointments (tenant_id, employee_id, start_at, end_at);

create table appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  old_status varchar(40),
  new_status varchar(40) not null,
  changed_by uuid references users(id),
  reason text,
  created_at timestamptz not null default now()
);

create index idx_appointment_status_history on appointment_status_history (tenant_id, appointment_id, created_at);

create table appointment_resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  resource_type varchar(40) not null,
  resource_id uuid not null,
  reserved_from timestamptz not null,
  reserved_to timestamptz not null,
  check (reserved_to > reserved_from)
);

create index idx_appointment_resources_overlap on appointment_resources (tenant_id, resource_type, resource_id, reserved_from, reserved_to);

create table appointment_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slot_key varchar(255) not null,
  reserved_by varchar(255),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slot_key)
);

alter table patients enable row level security;
alter table patient_contacts enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table appointment_status_history enable row level security;
alter table appointment_resources enable row level security;
alter table appointment_reservations enable row level security;

create policy tenant_isolation_patients on patients
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_patient_contacts on patient_contacts
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_services on services
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_appointments on appointments
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_appointment_status_history on appointment_status_history
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_appointment_resources on appointment_resources
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

create policy tenant_isolation_appointment_reservations on appointment_reservations
  using (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
