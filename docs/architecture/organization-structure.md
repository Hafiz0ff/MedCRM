# ТЗ №3. Организационная структура клиники

## 1. Назначение

Модуль `organization-structure` управляет филиалами, отделениями, сотрудниками, должностями, кабинетами, оборудованием, графиками ресурсов и привязками врачей к кабинетам. Он является фундаментом для будущего `scheduling` module: онлайн-запись, календарь, лист ожидания и автоматическое распределение кабинетов опираются на эти данные.

Модуль работает в рамках утвержденной SaaS multi-tenant архитектуры:

- каждая tenant-owned таблица содержит `tenant_id`;
- branch-owned данные фильтруются по `branch_id in allowed_branches`;
- все изменения пишутся в audit log;
- доступ проверяется через Auth/RBAC и module/feature flags.

## 2. Подмодули

```text
organization-structure
  |
  |-- branches
  |-- departments
  |-- employees
  |-- positions
  |-- rooms
  |-- equipment
  |-- schedules
  |-- directories
```

| Подмодуль   | Ответственность                                               |
| ----------- | ------------------------------------------------------------- |
| branches    | Филиалы, адреса, телефоны, часовые пояса, базовые часы работы |
| departments | Отделения, вложенная структура, цветовая маркировка           |
| employees   | Карточки сотрудников и связь с Auth user                      |
| positions   | Должности, медицинский/немедицинский персонал                 |
| rooms       | Паспорт кабинета, тип, вместимость, график                    |
| equipment   | Медицинское оборудование, обслуживание, калибровка            |
| schedules   | Универсальные графики и исключения ресурсов                   |
| directories | Настраиваемые справочники, import/export, RU/TJ localization  |

## 3. Иерархия

```text
Clinic / Tenant
  |
  |-- Branch
      |
      |-- Department
          |
          |-- Room
              |
              |-- Equipment
```

Сотрудник может работать в нескольких филиалах, нескольких отделениях и занимать несколько должностей. Для врача это особенно важно: например, в филиале №1 он стоматолог, а в филиале №2 хирург.

## 4. Основные связи

```text
tenants
  1 -- * branches
  1 -- * positions
  1 -- * employees
  1 -- * room_types
  1 -- * equipment_categories

branches
  1 -- * departments
  1 -- * rooms
  1 -- * equipment
  1 -- * employee_positions

departments
  1 -- * departments via parent_department_id
  1 -- * rooms
  1 -- * employee_positions

employees
  1 -- * employee_positions
  1 -- * employee_room_assignments

rooms
  * -- * specialties via room_specialties
  * -- * equipment via room_equipment
  1 -- * employee_room_assignments
```

## 5. Таблицы и назначение

### `branches`

Филиал клиники.

| Поле               | Тип         | Обязательность |
| ------------------ | ----------- | -------------- |
| id                 | uuid        | Да             |
| tenant_id          | uuid        | Да             |
| code               | varchar     | Да             |
| name               | varchar     | Да             |
| address            | text        | Нет            |
| phone              | varchar     | Нет            |
| timezone           | varchar     | Да             |
| working_hours_json | jsonb       | Да             |
| is_active          | boolean     | Да             |
| created_at         | timestamptz | Да             |
| updated_at         | timestamptz | Да             |

### `departments`

Отделение или направление: стоматология, гинекология, кардиология, лаборатория.

| Поле                 | Тип     | Обязательность |
| -------------------- | ------- | -------------- |
| id                   | uuid    | Да             |
| tenant_id            | uuid    | Да             |
| branch_id            | uuid    | Да             |
| parent_department_id | uuid    | Нет            |
| code                 | varchar | Да             |
| name                 | varchar | Да             |
| description          | text    | Нет            |
| color                | varchar | Нет            |
| is_active            | boolean | Да             |

Поддерживает вложенную древовидную структуру.

### `specialties`

Системный и расширяемый справочник медицинских специализаций.

| Поле               | Тип     | Обязательность |
| ------------------ | ------- | -------------- |
| id                 | uuid    | Да             |
| code               | varchar | Да             |
| name               | varchar | Да             |
| international_code | varchar | Нет            |
| is_system          | boolean | Да             |

Примеры: `dentist`, `gynecologist`, `cardiologist`.

### `positions`

Справочник должностей tenant-а.

| Поле             | Тип     | Обязательность               |
| ---------------- | ------- | ---------------------------- |
| id               | uuid    | Да                           |
| tenant_id        | uuid    | Нет для системных должностей |
| code             | varchar | Да                           |
| name             | varchar | Да                           |
| description      | text    | Нет                          |
| is_medical_staff | boolean | Да                           |
| is_system        | boolean | Да                           |
| is_active        | boolean | Да                           |

Примеры: главный врач, врач УЗИ, медсестра, администратор, кассир.

### `employees`

Карточка сотрудника. Может быть связана с Auth user, но не обязана иметь учетную запись на первом этапе.

| Поле            | Тип         | Обязательность |
| --------------- | ----------- | -------------- |
| id              | uuid        | Да             |
| tenant_id       | uuid        | Да             |
| user_id         | uuid        | Нет            |
| employee_number | varchar     | Да             |
| first_name      | varchar     | Да             |
| last_name       | varchar     | Да             |
| middle_name     | varchar     | Нет            |
| birth_date      | date        | Нет            |
| gender          | varchar     | Нет            |
| phone           | varchar     | Нет            |
| email           | varchar     | Нет            |
| hire_date       | date        | Нет            |
| dismissal_date  | date        | Нет            |
| employment_type | varchar     | Да             |
| photo_file_id   | uuid        | Нет            |
| status          | varchar     | Да             |
| created_at      | timestamptz | Да             |
| updated_at      | timestamptz | Да             |

### `employee_positions`

Назначение сотрудника в филиал, отделение, должность и специализацию.

| Поле          | Тип     | Обязательность |
| ------------- | ------- | -------------- |
| id            | uuid    | Да             |
| tenant_id     | uuid    | Да             |
| employee_id   | uuid    | Да             |
| branch_id     | uuid    | Да             |
| department_id | uuid    | Нет            |
| position_id   | uuid    | Да             |
| specialty_id  | uuid    | Нет            |
| work_rate     | numeric | Да             |
| is_primary    | boolean | Да             |
| active_from   | date    | Да             |
| active_to     | date    | Нет            |

`work_rate` хранит ставку сотрудника: например, `1.0`, `0.5`, `0.25`.

### `room_types`

Справочник типов кабинетов.

| Поле      | Тип     | Обязательность          |
| --------- | ------- | ----------------------- |
| id        | uuid    | Да                      |
| tenant_id | uuid    | Нет для системных типов |
| code      | varchar | Да                      |
| name      | varchar | Да                      |
| color     | varchar | Нет                     |
| is_system | boolean | Да                      |

Примеры: кабинет врача, операционная, УЗИ кабинет, процедурный, лаборатория.

### `rooms`

Паспорт кабинета.

| Поле          | Тип     | Обязательность |
| ------------- | ------- | -------------- |
| id            | uuid    | Да             |
| tenant_id     | uuid    | Да             |
| branch_id     | uuid    | Да             |
| department_id | uuid    | Нет            |
| room_type_id  | uuid    | Да             |
| code          | varchar | Да             |
| name          | varchar | Да             |
| floor         | varchar | Нет            |
| capacity      | integer | Да             |
| description   | text    | Нет            |
| schedule_json | jsonb   | Да             |
| status        | varchar | Да             |
| is_active     | boolean | Да             |

Паспорт кабинета содержит:

- список оборудования;
- допустимые процедуры;
- график работы;
- ограничения по загрузке;
- доступные специализации.

### `room_specialties`

Какие специалисты могут работать в кабинете.

| Поле         | Тип  | Обязательность |
| ------------ | ---- | -------------- |
| id           | uuid | Да             |
| room_id      | uuid | Да             |
| specialty_id | uuid | Да             |

Пример: УЗИ кабинет доступен для `radiologist` и `gynecologist`.

### `equipment_categories`

Категории оборудования.

| Поле      | Тип     | Обязательность              |
| --------- | ------- | --------------------------- |
| id        | uuid    | Да                          |
| tenant_id | uuid    | Нет для системных категорий |
| code      | varchar | Да                          |
| name      | varchar | Да                          |
| is_system | boolean | Да                          |

### `equipment`

Медицинское оборудование и shared resources.

| Поле               | Тип     | Обязательность |
| ------------------ | ------- | -------------- |
| id                 | uuid    | Да             |
| tenant_id          | uuid    | Да             |
| branch_id          | uuid    | Да             |
| room_id            | uuid    | Нет            |
| category_id        | uuid    | Да             |
| inventory_number   | varchar | Да             |
| serial_number      | varchar | Нет            |
| name               | varchar | Да             |
| manufacturer       | varchar | Нет            |
| model              | varchar | Нет            |
| purchase_date      | date    | Нет            |
| maintenance_date   | date    | Нет            |
| calibration_date   | date    | Нет            |
| status             | varchar | Да             |
| is_shared_resource | boolean | Да             |

### `room_equipment`

История установки оборудования в кабинеты.

| Поле         | Тип         | Обязательность |
| ------------ | ----------- | -------------- |
| id           | uuid        | Да             |
| room_id      | uuid        | Да             |
| equipment_id | uuid        | Да             |
| installed_at | timestamptz | Да             |
| removed_at   | timestamptz | Нет            |

### `employee_room_assignments`

Связь врача, кабинета, отделения, специализации и рабочего графика.

| Поле               | Тип   | Обязательность |
| ------------------ | ----- | -------------- |
| id                 | uuid  | Да             |
| tenant_id          | uuid  | Да             |
| employee_id        | uuid  | Да             |
| branch_id          | uuid  | Да             |
| department_id      | uuid  | Нет            |
| room_id            | uuid  | Да             |
| specialty_id       | uuid  | Нет            |
| active_from        | date  | Да             |
| active_to          | date  | Нет            |
| work_schedule_json | jsonb | Да             |

### `working_schedules`

Универсальный график для branch, room, employee, equipment.

| Поле            | Тип      | Обязательность |
| --------------- | -------- | -------------- |
| id              | uuid     | Да             |
| tenant_id       | uuid     | Да             |
| entity_type     | varchar  | Да             |
| entity_id       | uuid     | Да             |
| weekday         | smallint | Да             |
| start_time      | time     | Да             |
| end_time        | time     | Да             |
| break_start     | time     | Нет            |
| break_end       | time     | Нет            |
| recurrence_rule | text     | Нет            |
| timezone        | varchar  | Да             |
| is_active       | boolean  | Да             |

`entity_type`: `branch`, `room`, `employee`, `equipment`.

### `schedule_exceptions`

Исключения расписания: ремонт кабинета, отпуск врача, обслуживание аппарата.

| Поле           | Тип     | Обязательность |
| -------------- | ------- | -------------- |
| id             | uuid    | Да             |
| tenant_id      | uuid    | Да             |
| entity_type    | varchar | Да             |
| entity_id      | uuid    | Да             |
| exception_date | date    | Да             |
| reason         | text    | Нет            |
| start_time     | time    | Нет            |
| end_time       | time    | Нет            |
| is_day_off     | boolean | Да             |

## 6. SQL baseline

```sql
create table branches (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  address text,
  phone varchar(60),
  timezone varchar(80) not null,
  working_hours_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table departments (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  parent_department_id uuid references departments(id),
  code varchar(120) not null,
  name varchar(255) not null,
  description text,
  color varchar(40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, code)
);

create table specialties (
  id uuid primary key,
  code varchar(120) not null unique,
  name varchar(255) not null,
  international_code varchar(120),
  is_system boolean not null default true
);

create table positions (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  description text,
  is_medical_staff boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table employees (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  user_id uuid references users(id),
  employee_number varchar(120) not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  middle_name varchar(120),
  birth_date date,
  gender varchar(40),
  phone varchar(60),
  email varchar(255),
  hire_date date,
  dismissal_date date,
  employment_type varchar(80) not null,
  photo_file_id uuid,
  status varchar(40) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_number)
);

create table employee_positions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  employee_id uuid not null references employees(id),
  branch_id uuid not null references branches(id),
  department_id uuid references departments(id),
  position_id uuid not null references positions(id),
  specialty_id uuid references specialties(id),
  work_rate numeric(4,2) not null default 1.0,
  is_primary boolean not null default false,
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now()
);

create table room_types (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  color varchar(40),
  is_system boolean not null default false,
  unique (tenant_id, code)
);

create table rooms (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  department_id uuid references departments(id),
  room_type_id uuid not null references room_types(id),
  code varchar(120) not null,
  name varchar(255) not null,
  floor varchar(40),
  capacity integer not null default 1,
  description text,
  schedule_json jsonb not null default '{}'::jsonb,
  status varchar(40) not null default 'active',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, code)
);

create table room_specialties (
  id uuid primary key,
  room_id uuid not null references rooms(id),
  specialty_id uuid not null references specialties(id),
  unique (room_id, specialty_id)
);

create table equipment_categories (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  is_system boolean not null default false,
  unique (tenant_id, code)
);

create table equipment (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  room_id uuid references rooms(id),
  category_id uuid not null references equipment_categories(id),
  inventory_number varchar(120) not null,
  serial_number varchar(120),
  name varchar(255) not null,
  manufacturer varchar(255),
  model varchar(255),
  purchase_date date,
  maintenance_date date,
  calibration_date date,
  status varchar(40) not null default 'active',
  is_shared_resource boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, inventory_number)
);

create table room_equipment (
  id uuid primary key,
  room_id uuid not null references rooms(id),
  equipment_id uuid not null references equipment(id),
  installed_at timestamptz not null default now(),
  removed_at timestamptz
);

create table employee_room_assignments (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  employee_id uuid not null references employees(id),
  branch_id uuid not null references branches(id),
  department_id uuid references departments(id),
  room_id uuid not null references rooms(id),
  specialty_id uuid references specialties(id),
  active_from date not null,
  active_to date,
  work_schedule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table working_schedules (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  entity_type varchar(40) not null,
  entity_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  recurrence_rule text,
  timezone varchar(80) not null,
  is_active boolean not null default true
);

create table schedule_exceptions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  entity_type varchar(40) not null,
  entity_id uuid not null,
  exception_date date not null,
  reason text,
  start_time time,
  end_time time,
  is_day_off boolean not null default false
);
```

## 7. Directory Engine

Справочники должны поддерживать:

- динамическое добавление записей администратором клиники;
- системные записи, недоступные для удаления;
- расширение системных справочников локальными значениями tenant-а;
- soft configuration без участия разработчиков;
- import/export;
- localization RU/TJ;
- audit logging всех изменений.

Справочники модуля:

- `specialties`;
- `positions`;
- `room_types`;
- `equipment_categories`.

## 8. Shared resource и resource conflicts

Shared resource логика критична для расписания. Например, аппарат УЗИ не может использоваться одновременно, даже если врачей несколько.

Scheduling engine при создании записи обязан проверить:

1. Доступность врача.
2. Доступность кабинета.
3. Доступность оборудования.
4. Ограничения филиала.
5. Ограничения специализации.
6. Исключения расписания.

Публичный contract для будущего scheduling module:

```ts
export type ResourceAvailabilityRequest = {
  tenantId: string;
  branchId: string;
  employeeId?: string;
  roomId?: string;
  equipmentIds?: string[];
  specialtyId?: string;
  startsAt: string;
  endsAt: string;
};

export type ResourceAvailabilityResult = {
  available: boolean;
  conflicts: Array<{
    resourceType: 'employee' | 'room' | 'equipment' | 'branch' | 'specialty';
    resourceId: string;
    reason: string;
  }>;
};
```

## 9. Audit events

Модуль пишет audit events:

- `branch.created`;
- `branch.updated`;
- `department.created`;
- `department.moved`;
- `employee.created`;
- `employee.updated`;
- `employee.assigned`;
- `employee.dismissed`;
- `position.created`;
- `room.created`;
- `room.updated`;
- `room.schedule.changed`;
- `equipment.created`;
- `equipment.updated`;
- `equipment.moved`;
- `equipment.maintenance.changed`;
- `schedule.exception.created`.

## 10. Multi-tenant и branch-level filtering

Все tenant-owned таблицы содержат `tenant_id`.

Branch-owned сущности дополнительно содержат `branch_id`:

- `departments`;
- `rooms`;
- `equipment`;
- `employee_positions`;
- `employee_room_assignments`.

Запросы должны применять:

```text
tenant_id = current_tenant
branch_id in allowed_branches
```

Для глобальных справочников допускается `tenant_id is null`, если запись системная. Tenant-level расширения справочников видны только своему tenant-у.

## 11. API архитектура

REST endpoints:

```text
GET    /branches
POST   /branches
GET    /branches/:id
PATCH  /branches/:id

GET    /departments
POST   /departments
PATCH  /departments/:id
POST   /departments/:id/move

GET    /employees
POST   /employees
GET    /employees/:id
PATCH  /employees/:id
POST   /employees/:id/positions
POST   /employees/:id/room-assignments

GET    /rooms
POST   /rooms
GET    /rooms/:id
PATCH  /rooms/:id
POST   /rooms/:id/equipment
POST   /rooms/:id/specialties

GET    /equipment
POST   /equipment
GET    /equipment/:id
PATCH  /equipment/:id
POST   /equipment/:id/move

GET    /directories/:type
POST   /directories/:type
PATCH  /directories/:type/:id

GET    /resource-availability
```

Все list endpoints поддерживают:

- pagination;
- filtering;
- sorting;
- branch filtering;
- audit metadata для чувствительных изменений.

## 12. Permissions

Минимальные permissions:

- `organization.branches.read`;
- `organization.branches.manage`;
- `organization.departments.read`;
- `organization.departments.manage`;
- `organization.employees.read`;
- `organization.employees.manage`;
- `organization.rooms.read`;
- `organization.rooms.manage`;
- `organization.equipment.read`;
- `organization.equipment.manage`;
- `organization.directories.read`;
- `organization.directories.manage`;
- `organization.schedules.manage`.

## 13. UI требования

Frontend модуль должен поддерживать:

- tree navigation по филиалам и отделениям;
- drag-and-drop для структуры отделений;
- визуальную загрузку кабинетов;
- цветовую маркировку отделений;
- быстрый поиск сотрудников;
- паспорт кабинета;
- карточку оборудования;
- карточку сотрудника;
- фильтры по филиалу, отделению, должности и специализации;
- RU/TJ localization.

Основные экраны:

- `Organization Tree`;
- `Branches`;
- `Departments`;
- `Employees`;
- `Rooms`;
- `Equipment`;
- `Directories`;
- `Schedules`.

## 14. Module manifest

```ts
export const OrganizationStructureModuleManifest = {
  code: 'organization-structure',
  name: 'Organization Structure',
  version: '1.0.0',
  isCore: false,
  dependencies: ['auth'],
  permissions: [
    'organization.branches.read',
    'organization.branches.manage',
    'organization.departments.read',
    'organization.departments.manage',
    'organization.employees.read',
    'organization.employees.manage',
    'organization.rooms.read',
    'organization.rooms.manage',
    'organization.equipment.read',
    'organization.equipment.manage',
    'organization.directories.read',
    'organization.directories.manage',
    'organization.schedules.manage',
  ],
  events: {
    publishes: [
      'branch.created',
      'department.created',
      'employee.assigned',
      'room.created',
      'equipment.updated',
    ],
    subscribes: [],
  },
} as const;
```
