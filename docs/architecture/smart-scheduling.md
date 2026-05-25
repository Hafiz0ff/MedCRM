# ТЗ №5. Smart Scheduling & Booking

## 1. Назначение

Модуль `smart-scheduling` управляет календарями врачей, онлайн и офлайн записью, доступностью ресурсов, листом ожидания, временными резервациями и realtime обновлениями расписания.

Appointment является:

- единицей расписания;
- CRM событием;
- основой patient journey;
- точкой интеграции с EMR;
- финансовым событием;
- единицей аналитики.

Модуль опирается на:

- `auth` и branch-level permissions;
- `organization-structure` для филиалов, врачей, кабинетов, оборудования и working schedules;
- `patient-crm` для пациента, timeline и коммуникаций;
- `communications` для reminders.

## 2. Подмодули

```text
smart-scheduling
  |
  |-- appointments
  |-- calendars
  |-- availability-engine
  |-- conflict-engine
  |-- waiting-list
  |-- online-booking
  |-- public-booking-api
  |-- recurrence-engine
  |-- reminders
  |-- booking-rules
  |-- resource-reservations
```

| Подмодуль             | Ответственность                                         |
| --------------------- | ------------------------------------------------------- |
| appointments          | CRUD записей, жизненный цикл визита                     |
| calendars             | Day/week/month views, врач/кабинет/филиал               |
| availability-engine   | Расчет свободных окон и optimal slots                   |
| conflict-engine       | Проверка пересечений врача, кабинета, оборудования      |
| waiting-list          | Лист ожидания и matching после отмен                    |
| online-booking        | Omnichannel booking flow                                |
| public-booking-api    | Публичные слоты, captcha, anti-spam, phone verification |
| recurrence-engine     | Серии визитов и повторные процедуры                     |
| reminders             | Уведомления до/после визита                             |
| booking-rules         | Ограничения услуг, филиалов, буферы, политики           |
| resource-reservations | Временная блокировка слотов и resource locks            |

## 3. Статусная модель Appointment

```text
SCHEDULED
  |
CONFIRMED
  |
CHECKED_IN
  |
IN_PROGRESS
  |
COMPLETED

Alternative:
  CANCELLED
  NO_SHOW
  RESCHEDULED
```

Правила:

- `SCHEDULED` - запись создана;
- `CONFIRMED` - пациент подтвердил визит;
- `CHECKED_IN` - пациент пришел в клинику;
- `IN_PROGRESS` - врач начал прием;
- `COMPLETED` - прием завершен;
- `NO_SHOW` - пациент не пришел;
- `CANCELLED` - отмена;
- `RESCHEDULED` - перенос записи с сохранением истории.

Все переходы статусов пишутся в `appointment_status_history` и audit log.

## 4. Таблицы

### `appointments`

Основная таблица записей.

| Поле                | Тип         | Обязательность |
| ------------------- | ----------- | -------------- |
| id                  | uuid        | Да             |
| tenant_id           | uuid        | Да             |
| branch_id           | uuid        | Да             |
| patient_id          | uuid        | Да             |
| employee_id         | uuid        | Да             |
| department_id       | uuid        | Нет            |
| room_id             | uuid        | Нет            |
| service_id          | uuid        | Нет            |
| appointment_number  | varchar     | Да             |
| booking_source      | varchar     | Да             |
| appointment_type    | varchar     | Да             |
| status              | varchar     | Да             |
| priority            | varchar     | Да             |
| start_at            | timestamptz | Да             |
| end_at              | timestamptz | Да             |
| duration_minutes    | integer     | Да             |
| notes               | text        | Нет            |
| cancellation_reason | text        | Нет            |
| confirmed_at        | timestamptz | Нет            |
| checked_in_at       | timestamptz | Нет            |
| completed_at        | timestamptz | Нет            |
| cancelled_at        | timestamptz | Нет            |
| created_by          | uuid        | Нет            |
| created_at          | timestamptz | Да             |
| updated_at          | timestamptz | Да             |

`booking_source`: `ADMIN_PANEL`, `ONLINE_WIDGET`, `TELEGRAM_BOT`, `WHATSAPP`, `PHONE_CALL`, `WALK_IN`, `API`.

`appointment_type`: `CONSULTATION`, `PROCEDURE`, `FOLLOW_UP`, `ONLINE_CONSULTATION`, `LAB_VISIT`, `DIAGNOSTIC`.

### `appointment_status_history`

| Поле           | Тип         | Обязательность |
| -------------- | ----------- | -------------- |
| id             | uuid        | Да             |
| tenant_id      | uuid        | Да             |
| appointment_id | uuid        | Да             |
| old_status     | varchar     | Нет            |
| new_status     | varchar     | Да             |
| changed_by     | uuid        | Нет            |
| reason         | text        | Нет            |
| created_at     | timestamptz | Да             |

### `appointment_resources`

Ресурсы, занятые записью.

| Поле           | Тип         | Обязательность |
| -------------- | ----------- | -------------- |
| id             | uuid        | Да             |
| tenant_id      | uuid        | Да             |
| appointment_id | uuid        | Да             |
| resource_type  | varchar     | Да             |
| resource_id    | uuid        | Да             |
| reserved_from  | timestamptz | Да             |
| reserved_to    | timestamptz | Да             |

`resource_type`: `EMPLOYEE`, `ROOM`, `EQUIPMENT`.

### `resource_buffers`

Буферное время до/после использования ресурса.

| Поле           | Тип     | Обязательность |
| -------------- | ------- | -------------- |
| id             | uuid    | Да             |
| tenant_id      | uuid    | Да             |
| resource_type  | varchar | Да             |
| resource_id    | uuid    | Да             |
| before_minutes | integer | Да             |
| after_minutes  | integer | Да             |

Буферы покрывают санитарный интервал, подготовку кабинета и настройку оборудования.

### `services`

Справочник услуг для записи.

| Поле               | Тип     | Обязательность |
| ------------------ | ------- | -------------- |
| id                 | uuid    | Да             |
| tenant_id          | uuid    | Да             |
| code               | varchar | Да             |
| name               | varchar | Да             |
| duration_minutes   | integer | Да             |
| requires_room      | boolean | Да             |
| requires_equipment | boolean | Да             |
| color              | varchar | Нет            |
| is_online_bookable | boolean | Да             |
| is_active          | boolean | Да             |

### `service_required_resources`

| Поле                 | Тип     | Обязательность |
| -------------------- | ------- | -------------- |
| id                   | uuid    | Да             |
| service_id           | uuid    | Да             |
| resource_type        | varchar | Да             |
| resource_category_id | uuid    | Нет            |

Пример: УЗИ требует `ROOM: ultrasound_room` и `EQUIPMENT: ultrasound_machine`.

### `availability_cache`

Кэш свободных слотов для online booking.

| Поле                 | Тип         | Обязательность |
| -------------------- | ----------- | -------------- |
| id                   | uuid        | Да             |
| tenant_id            | uuid        | Да             |
| employee_id          | uuid        | Нет            |
| branch_id            | uuid        | Да             |
| date                 | date        | Да             |
| available_slots_json | jsonb       | Да             |
| recalculated_at      | timestamptz | Да             |

### `waiting_list`

| Поле                | Тип         | Обязательность |
| ------------------- | ----------- | -------------- |
| id                  | uuid        | Да             |
| tenant_id           | uuid        | Да             |
| patient_id          | uuid        | Да             |
| branch_id           | uuid        | Да             |
| employee_id         | uuid        | Нет            |
| preferred_date_from | date        | Нет            |
| preferred_date_to   | date        | Нет            |
| preferred_time_from | time        | Нет            |
| preferred_time_to   | time        | Нет            |
| service_id          | uuid        | Нет            |
| priority            | integer     | Да             |
| notes               | text        | Нет            |
| status              | varchar     | Да             |
| created_at          | timestamptz | Да             |

Статусы: `ACTIVE`, `MATCHED`, `CANCELLED`, `EXPIRED`.

### `appointment_reservations`

Временные блокировки слотов для online booking.

| Поле        | Тип         | Обязательность |
| ----------- | ----------- | -------------- |
| id          | uuid        | Да             |
| tenant_id   | uuid        | Да             |
| slot_key    | varchar     | Да             |
| reserved_by | varchar     | Нет            |
| expires_at  | timestamptz | Да             |
| created_at  | timestamptz | Да             |

TTL: 5-10 минут.

### `online_booking_tokens`

| Поле       | Тип         | Обязательность |
| ---------- | ----------- | -------------- |
| id         | uuid        | Да             |
| tenant_id  | uuid        | Да             |
| patient_id | uuid        | Нет            |
| token      | varchar     | Да             |
| expires_at | timestamptz | Да             |
| ip_address | inet        | Нет            |
| created_at | timestamptz | Да             |

### `appointment_recurrence_rules`

| Поле            | Тип     | Обязательность |
| --------------- | ------- | -------------- |
| id              | uuid    | Да             |
| appointment_id  | uuid    | Да             |
| recurrence_type | varchar | Да             |
| interval        | integer | Да             |
| end_date        | date    | Нет            |

### `appointment_notifications`

| Поле              | Тип         | Обязательность |
| ----------------- | ----------- | -------------- |
| id                | uuid        | Да             |
| tenant_id         | uuid        | Да             |
| appointment_id    | uuid        | Да             |
| notification_type | varchar     | Да             |
| channel           | varchar     | Да             |
| status            | varchar     | Да             |
| sent_at           | timestamptz | Нет            |
| delivered_at      | timestamptz | Нет            |

## 5. SQL baseline

```sql
create table services (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  duration_minutes integer not null,
  requires_room boolean not null default true,
  requires_equipment boolean not null default false,
  color varchar(40),
  is_online_bookable boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table service_required_resources (
  id uuid primary key,
  service_id uuid not null references services(id),
  resource_type varchar(40) not null,
  resource_category_id uuid
);

create table appointments (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  patient_id uuid not null references patients(id),
  employee_id uuid not null references employees(id),
  department_id uuid references departments(id),
  room_id uuid references rooms(id),
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

create index idx_appointments_calendar
  on appointments (tenant_id, branch_id, employee_id, start_at, end_at);

create table appointment_status_history (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  old_status varchar(40),
  new_status varchar(40) not null,
  changed_by uuid references users(id),
  reason text,
  created_at timestamptz not null default now()
);

create table appointment_resources (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  resource_type varchar(40) not null,
  resource_id uuid not null,
  reserved_from timestamptz not null,
  reserved_to timestamptz not null,
  check (reserved_to > reserved_from)
);

create index idx_appointment_resources_overlap
  on appointment_resources (tenant_id, resource_type, resource_id, reserved_from, reserved_to);

create table resource_buffers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  resource_type varchar(40) not null,
  resource_id uuid not null,
  before_minutes integer not null default 0,
  after_minutes integer not null default 0,
  unique (tenant_id, resource_type, resource_id)
);

create table availability_cache (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  employee_id uuid references employees(id),
  branch_id uuid not null references branches(id),
  date date not null,
  available_slots_json jsonb not null default '[]'::jsonb,
  recalculated_at timestamptz not null,
  unique (tenant_id, branch_id, employee_id, date)
);

create table waiting_list (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  branch_id uuid not null references branches(id),
  employee_id uuid references employees(id),
  preferred_date_from date,
  preferred_date_to date,
  preferred_time_from time,
  preferred_time_to time,
  service_id uuid references services(id),
  priority integer not null default 0,
  notes text,
  status varchar(40) not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table appointment_reservations (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  slot_key varchar(255) not null,
  reserved_by varchar(255),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slot_key)
);

create table online_booking_tokens (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid references patients(id),
  token varchar(255) not null unique,
  expires_at timestamptz not null,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table appointment_recurrence_rules (
  id uuid primary key,
  appointment_id uuid not null references appointments(id),
  recurrence_type varchar(40) not null,
  interval integer not null default 1,
  end_date date
);

create table appointment_notifications (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  notification_type varchar(80) not null,
  channel varchar(40) not null,
  status varchar(40) not null default 'PENDING',
  sent_at timestamptz,
  delivered_at timestamptz
);
```

## 6. Conflict Resolution Engine

Availability/conflict checks:

1. Employee availability.
2. Room availability.
3. Equipment availability.
4. Working schedules.
5. Schedule exceptions.
6. Branch restrictions.
7. Service restrictions.
8. Buffer time.
9. Maintenance windows.

Формула пересечения времени:

```sql
new_start < existing_end
and new_end > existing_start
```

Проверка ресурса:

```sql
select 1
from appointment_resources ar
join appointments a on a.id = ar.appointment_id
where ar.tenant_id = :tenant_id
  and ar.resource_type = :resource_type
  and ar.resource_id = :resource_id
  and a.status not in ('CANCELLED', 'NO_SHOW', 'RESCHEDULED')
  and :new_start < ar.reserved_to
  and :new_end > ar.reserved_from
limit 1;
```

Shared resource правило: запись невозможна, если занято оборудование, даже когда врач и кабинет свободны.

## 7. Resource locking

Для предотвращения race conditions используется комбинированный подход:

- PostgreSQL transaction;
- `select ... for update` на затрагиваемых resource rows;
- Redis distributed lock для public online booking;
- unique `appointment_reservations(tenant_id, slot_key)`;
- idempotency key для повторных online/API запросов.

Создание записи:

```text
1. Start transaction.
2. Acquire Redis lock for slot/resource group.
3. Lock candidate resources in DB.
4. Re-run conflict checks inside transaction.
5. Create appointment.
6. Create appointment_resources.
7. Write status history and audit event.
8. Publish appointment.created and slot.updated.
9. Commit transaction.
10. Release Redis lock.
```

## 8. Availability Engine

Engine рассчитывает:

- свободные окна;
- оптимальные интервалы;
- перегрузку врачей;
- room utilization;
- equipment utilization;
- slots для online booking;
- alternatives при конфликте.

Источники данных:

- `working_schedules`;
- `schedule_exceptions`;
- `employee_positions`;
- `employee_room_assignments`;
- `rooms`;
- `equipment`;
- `services`;
- `service_required_resources`;
- `appointments`;
- `appointment_resources`;
- `resource_buffers`;
- `appointment_reservations`.

## 9. Автоматический подбор ресурсов

Система может:

- автоматически подобрать кабинет;
- автоматически подобрать оборудование;
- предложить свободные слоты;
- ранжировать варианты по минимальному простою;
- учитывать department, specialty и service restrictions.

Контракт:

```ts
export type SlotSuggestionRequest = {
  tenantId: string;
  branchId: string;
  patientId?: string;
  employeeId?: string;
  serviceId?: string;
  dateFrom: string;
  dateTo: string;
  preferredTimeFrom?: string;
  preferredTimeTo?: string;
};

export type SlotSuggestion = {
  startsAt: string;
  endsAt: string;
  employeeId: string;
  roomId?: string;
  equipmentIds: string[];
  score: number;
};
```

## 10. Waiting List

Пациент может ждать:

- определенного врача;
- определенную дату;
- ближайшее окно;
- конкретную услугу.

При отмене записи:

1. Система ищет matching patients.
2. Сортирует по priority, waiting time и preferred slot match.
3. Отправляет уведомление.
4. Резервирует слот временно.
5. Публикует `waitinglist.matched`.

## 11. Online booking и Public Booking Gateway

`public-booking-api` поддерживает:

- website widgets;
- Telegram bots;
- WhatsApp booking;
- mobile apps;
- external APIs.

Функции:

- просмотр слотов;
- временная резервация;
- создание записи;
- подтверждение телефона;
- captcha/rate limit;
- anti-spam;
- online booking token lifecycle.

Public flow:

```text
1. Public client requests available slots.
2. API applies tenant public booking config.
3. Client reserves slot for 5-10 minutes.
4. Patient confirms phone/token.
5. API creates or matches patient profile.
6. Conflict checks run again.
7. Appointment is created.
8. Patient receives confirmation.
```

## 12. Realtime

Socket.IO events:

- `appointment.created`;
- `appointment.updated`;
- `appointment.cancelled`;
- `appointment.rescheduled`;
- `slot.updated`;
- `waitinglist.matched`.

Rooms:

```text
tenant:{tenant_id}:branch:{branch_id}:calendar
tenant:{tenant_id}:employee:{employee_id}:calendar
tenant:{tenant_id}:room:{room_id}:calendar
```

Все handshake и events проходят JWT/session validation, tenant isolation и branch access checks.

## 13. Reminder Engine

Автоуведомления:

- за 24 часа;
- за 2 часа;
- после отмены;
- после переноса;
- после no-show.

Каналы:

- Telegram;
- WhatsApp;
- SMS;
- Email.

Reminder Engine публикует задания в BullMQ и использует communications module для доставки.

## 14. Multi-branch scheduling

Система должна:

- разделять расписания филиалов;
- учитывать timezone филиала;
- поддерживать cross-branch doctors;
- проверять branch access пользователя;
- не допускать пересечения врача между филиалами.

Cross-branch conflict для врача проверяется по `employee_id` вне зависимости от `branch_id`, если интервалы времени пересекаются.

## 15. Audit events

Фиксировать:

- `appointment.created`;
- `appointment.confirmed`;
- `appointment.checked_in`;
- `appointment.started`;
- `appointment.completed`;
- `appointment.rescheduled`;
- `appointment.cancelled`;
- `appointment.no_show`;
- `appointment.conflict.detected`;
- `appointment.resource.locked`;
- `waitinglist.created`;
- `waitinglist.matched`;
- `online_booking.slot.reserved`;
- `online_booking.completed`.

## 16. API архитектура

REST endpoints:

```text
GET    /appointments
POST   /appointments
GET    /appointments/:id
PATCH  /appointments/:id
POST   /appointments/:id/confirm
POST   /appointments/:id/check-in
POST   /appointments/:id/start
POST   /appointments/:id/complete
POST   /appointments/:id/cancel
POST   /appointments/:id/reschedule

GET    /calendar
GET    /availability
GET    /slots
POST   /slots/reserve

GET    /waiting-list
POST   /waiting-list
PATCH  /waiting-list/:id

GET    /resources/availability
GET    /resources/utilization

GET    /online-booking/slots
POST   /online-booking/reservations
POST   /online-booking/confirm-phone
POST   /online-booking/appointments
```

Поддержка:

- filtering;
- pagination;
- realtime subscriptions;
- branch filters;
- calendar range filters;
- idempotency keys for create/reschedule.

## 17. Permissions

Минимальные permissions:

- `scheduling.appointments.read`;
- `scheduling.appointments.create`;
- `scheduling.appointments.update`;
- `scheduling.appointments.cancel`;
- `scheduling.appointments.reschedule`;
- `scheduling.calendar.read`;
- `scheduling.calendar.manage`;
- `scheduling.availability.read`;
- `scheduling.waiting_list.read`;
- `scheduling.waiting_list.manage`;
- `scheduling.online_booking.manage`;
- `scheduling.resources.manage`;

## 18. UI требования

Calendar UI:

- day/week/month view;
- drag-and-drop переноса записей;
- color coding по статусу, врачу, услуге или отделению;
- room utilization;
- equipment visualization;
- realtime updates;
- warning при конфликте;
- waiting list panel;
- быстрые действия: confirm, check-in, start, complete, cancel, reschedule;
- timezone-aware отображение для multi-branch;
- фильтры по филиалу, врачу, кабинету, услуге, статусу.

## 19. Интеграция с будущими модулями

Модуль готовится к интеграции:

- `EMR` - открытие приема и клиническая запись;
- `finance` - счет/оплата по визиту;
- `telephony` - запись из звонка;
- `CRM automation` - patient journey triggers;
- `BI analytics` - utilization, no-show, conversion;
- `queue management` - check-in и очередь ожидания;
- `loyalty` - начисления и family balance.

## 20. Module manifest

```ts
export const SmartSchedulingModuleManifest = {
  code: 'smart-scheduling',
  name: 'Smart Scheduling',
  version: '1.0.0',
  isCore: false,
  dependencies: ['auth', 'organization-structure', 'patient-crm', 'communications'],
  permissions: [
    'scheduling.appointments.read',
    'scheduling.appointments.create',
    'scheduling.appointments.update',
    'scheduling.appointments.cancel',
    'scheduling.appointments.reschedule',
    'scheduling.calendar.read',
    'scheduling.calendar.manage',
    'scheduling.availability.read',
    'scheduling.waiting_list.read',
    'scheduling.waiting_list.manage',
    'scheduling.online_booking.manage',
    'scheduling.resources.manage',
  ],
  events: {
    publishes: [
      'appointment.created',
      'appointment.confirmed',
      'appointment.completed',
      'appointment.cancelled',
      'appointment.rescheduled',
      'slot.updated',
      'waitinglist.matched',
    ],
    subscribes: [
      'employee.assigned',
      'room.schedule.changed',
      'equipment.maintenance.changed',
      'patient.created',
    ],
  },
} as const;
```
