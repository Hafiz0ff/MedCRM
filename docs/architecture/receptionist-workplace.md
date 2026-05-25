# ТЗ №6. Receptionist Workplace

## 1. Назначение

Модуль `receptionist-workplace` реализует АРМ администратора клиники: единое операционное окно для регистрации пациентов, управления визитами, быстрой записи, обработки входящих звонков, очереди, подготовки счетов и CRM-взаимодействия.

АРМ является orchestration-слоем между:

- `patient-crm`;
- `smart-scheduling`;
- `communications`;
- `finance foundation`;
- `organization-structure`;
- realtime layer.

Цель: минимизировать количество кликов, переключения между экранами и время обработки пациента. Основные действия должны выполняться без перехода между страницами.

## 2. Подмодули

```text
receptionist-workplace
  |
  |-- todays-board
  |-- fast-booking
  |-- patient-search
  |-- queue-management
  |-- call-handling
  |-- visit-control
  |-- invoice-preparation
  |-- receptionist-timeline
  |-- realtime-dashboard
  |-- sticky-patient-context
  |-- offline-sync
```

| Подмодуль              | Ответственность                                       |
| ---------------------- | ----------------------------------------------------- |
| todays-board           | Главный realtime dashboard администратора             |
| fast-booking           | Быстрая запись через modal/command palette            |
| patient-search         | Быстрый fuzzy/transliteration поиск пациента          |
| queue-management       | Электронная очередь и статусы ожидания                |
| call-handling          | Входящие звонки, mini CRM card, unknown caller flow   |
| visit-control          | Быстрые переходы статусов визита                      |
| invoice-preparation    | Черновик счета после завершения приема                |
| receptionist-timeline  | Лента операционных действий                           |
| realtime-dashboard     | Socket.IO события и dashboard cache                   |
| sticky-patient-context | Глобальный выбранный пациент в popup/workflows        |
| offline-sync           | Локальный cache, optimistic UI, retry synchronization |

## 3. Today's Board

Главный экран администратора на сегодня. Дашборд агрегирует:

- appointments;
- patient CRM;
- room statuses;
- invoice statuses;
- realtime events.

Колонки:

1. `WAITING`;
2. `CHECKED_IN`;
3. `IN_PROGRESS`;
4. `COMPLETED_PENDING_PAYMENT`;
5. `COMPLETED`;
6. `NO_SHOW`;
7. `CANCELLED`.

Карточка визита отображает:

- ФИО пациента;
- возраст;
- врач;
- кабинет;
- время записи;
- статус;
- тип визита;
- VIP badge;
- долг/депозит;
- last visit indicator.

Цветовая система:

| Статус                    | Цвет   |
| ------------------------- | ------ |
| WAITING                   | yellow |
| CHECKED_IN                | blue   |
| IN_PROGRESS               | purple |
| COMPLETED_PENDING_PAYMENT | orange |
| COMPLETED                 | green  |
| NO_SHOW                   | red    |

## 4. Visit lifecycle UI

АРМ поддерживает:

- быстрый перевод статусов;
- drag-and-drop workflow;
- realtime обновления врачам;
- ручные overrides с обязательным reason;
- audit всех критичных действий.

Разрешенная основная цепочка:

```text
SCHEDULED
  -> CONFIRMED
  -> CHECKED_IN
  -> IN_PROGRESS
  -> COMPLETED_PENDING_PAYMENT
  -> COMPLETED
```

Альтернативные статусы:

- `CANCELLED`;
- `NO_SHOW`;
- `RESCHEDULED`.

Пример:

```text
Пациент пришел
  -> receptionist нажимает CHECK-IN
  -> appointment.status = CHECKED_IN
  -> doctor receives realtime update
  -> patient.checked_in event published
```

## 5. Таблицы

### `receptionist_dashboards_cache`

Кэш Today’s Board для realtime performance.

| Поле            | Тип         | Обязательность |
| --------------- | ----------- | -------------- |
| id              | uuid        | Да             |
| tenant_id       | uuid        | Да             |
| branch_id       | uuid        | Да             |
| dashboard_date  | date        | Да             |
| dashboard_json  | jsonb       | Да             |
| recalculated_at | timestamptz | Да             |

### `appointment_visit_states`

Операционная история переходов статусов через АРМ.

| Поле             | Тип         | Обязательность |
| ---------------- | ----------- | -------------- |
| id               | uuid        | Да             |
| tenant_id        | uuid        | Да             |
| appointment_id   | uuid        | Да             |
| old_state        | varchar     | Нет            |
| new_state        | varchar     | Да             |
| changed_by       | uuid        | Нет            |
| workstation_type | varchar     | Да             |
| created_at       | timestamptz | Да             |

### `visit_queue`

Электронная очередь.

| Поле                | Тип         | Обязательность |
| ------------------- | ----------- | -------------- |
| id                  | uuid        | Да             |
| tenant_id           | uuid        | Да             |
| branch_id           | uuid        | Да             |
| appointment_id      | uuid        | Да             |
| queue_number        | varchar     | Да             |
| queue_status        | varchar     | Да             |
| priority            | integer     | Да             |
| estimated_wait_time | integer     | Нет            |
| created_at          | timestamptz | Да             |

Статусы очереди:

- `WAITING`;
- `CALLED`;
- `IN_ROOM`;
- `COMPLETED`;
- `SKIPPED`.

### `incoming_calls`

Foundation для IP-телефонии.

| Поле              | Тип         | Обязательность |
| ----------------- | ----------- | -------------- |
| id                | uuid        | Да             |
| tenant_id         | uuid        | Да             |
| branch_id         | uuid        | Да             |
| phone_number      | varchar     | Да             |
| patient_id        | uuid        | Нет            |
| operator_user_id  | uuid        | Нет            |
| call_started_at   | timestamptz | Да             |
| call_ended_at     | timestamptz | Нет            |
| duration_seconds  | integer     | Нет            |
| call_result       | varchar     | Нет            |
| recording_file_id | uuid        | Нет            |

`call_result`: `MISSED`, `ANSWERED`, `BOOKED`, `CALLBACK_REQUIRED`, `SPAM`.

### `invoices`

Finance foundation версия счета.

| Поле            | Тип         | Обязательность |
| --------------- | ----------- | -------------- |
| id              | uuid        | Да             |
| tenant_id       | uuid        | Да             |
| branch_id       | uuid        | Да             |
| patient_id      | uuid        | Да             |
| appointment_id  | uuid        | Нет            |
| status          | varchar     | Да             |
| subtotal_amount | numeric     | Да             |
| discount_amount | numeric     | Да             |
| total_amount    | numeric     | Да             |
| created_by      | uuid        | Нет            |
| created_at      | timestamptz | Да             |

Статусы: `DRAFT`, `PENDING_PAYMENT`, `PAID`, `CANCELLED`.

### `invoice_items`

| Поле                  | Тип     | Обязательность |
| --------------------- | ------- | -------------- |
| id                    | uuid    | Да             |
| invoice_id            | uuid    | Да             |
| service_id            | uuid    | Нет            |
| quantity              | numeric | Да             |
| unit_price            | numeric | Да             |
| total_price           | numeric | Да             |
| performer_employee_id | uuid    | Нет            |

## 6. SQL baseline

```sql
create table receptionist_dashboards_cache (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  dashboard_date date not null,
  dashboard_json jsonb not null default '{}'::jsonb,
  recalculated_at timestamptz not null,
  unique (tenant_id, branch_id, dashboard_date)
);

create table appointment_visit_states (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  appointment_id uuid not null references appointments(id),
  old_state varchar(60),
  new_state varchar(60) not null,
  changed_by uuid references users(id),
  workstation_type varchar(80) not null default 'RECEPTIONIST',
  created_at timestamptz not null default now()
);

create table visit_queue (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  appointment_id uuid not null references appointments(id),
  queue_number varchar(80) not null,
  queue_status varchar(40) not null default 'WAITING',
  priority integer not null default 0,
  estimated_wait_time integer,
  created_at timestamptz not null default now(),
  unique (tenant_id, branch_id, queue_number)
);

create index idx_visit_queue_board
  on visit_queue (tenant_id, branch_id, queue_status, priority, created_at);

create table incoming_calls (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  phone_number varchar(80) not null,
  patient_id uuid references patients(id),
  operator_user_id uuid references users(id),
  call_started_at timestamptz not null,
  call_ended_at timestamptz,
  duration_seconds integer,
  call_result varchar(60),
  recording_file_id uuid,
  created_at timestamptz not null default now()
);

create index idx_incoming_calls_phone
  on incoming_calls (tenant_id, phone_number, call_started_at);

create table invoices (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  branch_id uuid not null references branches(id),
  patient_id uuid not null references patients(id),
  appointment_id uuid references appointments(id),
  status varchar(40) not null default 'DRAFT',
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table invoice_items (
  id uuid primary key,
  invoice_id uuid not null references invoices(id),
  service_id uuid references services(id),
  quantity numeric(10,2) not null default 1,
  unit_price numeric(14,2) not null default 0,
  total_price numeric(14,2) not null default 0,
  performer_employee_id uuid references employees(id)
);
```

## 7. Fast Booking

Быстрая запись открывается поверх интерфейса как modal/command palette и должна выполняться за 2-3 клика.

Flow:

```text
1. Поиск пациента.
2. Если пациент не найден, inline patient creation.
3. Выбор врача или услуги.
4. Suggested Slots Engine показывает ближайшие варианты.
5. Fast Availability Engine проверяет ресурсы realtime.
6. Receptionist подтверждает слот.
7. Создается appointment.
8. Dashboard и врач получают realtime update.
```

Inline patient creation:

- имя;
- телефон.

Быстрый поиск:

- телефон;
- ФИО;
- `patient_code`;
- family member;
- Telegram username;
- fuzzy search;
- transliteration RU/TJ.

## 8. Fast Availability и conflict UI

Во время записи система realtime проверяет:

- врача;
- кабинет;
- оборудование;
- buffer intervals;
- branch rules.

При конфликте UI показывает:

- конфликт врача;
- конфликт кабинета;
- конфликт оборудования;
- ближайшие альтернативы;
- возможность ручного override только при наличии permission.

Suggested Slots Engine предлагает:

- ближайшее окно;
- оптимальное окно;
- врача с минимальной загрузкой;
- preferred doctor пациента.

## 9. Queue Management

Очередь поддерживает:

- электронную очередь;
- приоритеты;
- emergency insertions;
- doctor queue visibility;
- realtime вызов пациента;
- skip/reorder с audit reason.

Очередь связана с appointment, но может отображаться в отдельной панели для врача и администратора.

## 10. Call Handling

При входящем звонке:

1. Система получает `phone_number`.
2. Ищет совпадение в `patient_contacts`.
3. Показывает mini CRM card.
4. Позволяет открыть fast booking, timeline или создать lead.

Mini CRM Card:

- ФИО;
- фото;
- статус пациента;
- VIP badge;
- последний визит;
- ближайшая запись;
- долги;
- notes warning.

Unknown Caller Flow:

- предложить создать пациента;
- создать lead;
- открыть fast booking.

Call Popup Engine:

- не блокирует интерфейс;
- работает realtime;
- открывается поверх dashboard;
- сохраняет call result.

## 11. Checkout Preparation

После завершения приема система формирует предварительный invoice.

Flow:

```text
COMPLETED
  -> AUTO CREATE INVOICE
  -> PENDING_PAYMENT
  -> Cashier/Reception Payment
```

Источник invoice items:

- appointment services;
- doctor additions;
- manual additions.

Finance foundation остается минимальным. Полный finance module может расширить счета оплатами, фискализацией, возвратами и кассовыми сменами.

## 12. Sticky Patient Context

При работе администратора выбранный пациент остается:

- в global context;
- доступен во всех popup;
- доступен в fast booking;
- доступен в invoice preparation;
- доступен в notes/timeline;
- без повторного поиска.

## 13. Receptionist Timeline

Отображает:

- звонки;
- записи;
- переносы;
- оплаты;
- сообщения;
- конфликтные ситуации;
- ручные overrides.

Timeline собирает события из `patient_timeline_events`, `appointments`, `incoming_calls`, `invoices` и audit metadata.

## 14. KPI администратора

Метрики:

- скорость обработки;
- конверсия звонков;
- количество записей;
- no-show rate;
- average booking time;
- время check-in;
- количество manual overrides.

KPI считаются асинхронно и отдаются в BI/analytics layer.

## 15. Offline и failure handling

При потере связи:

- queue local cache;
- optimistic UI для некритичных действий;
- retry synchronization;
- явная маркировка pending операций;
- блокировка рискованных операций без подтверждения сервера, например финальное создание записи при неизвестной доступности слота.

Конфликт после восстановления связи должен открывать resolution dialog.

## 16. Realtime

Socket.IO события:

- `patient.checked_in`;
- `doctor.started_visit`;
- `visit.completed`;
- `invoice.generated`;
- `queue.updated`;
- `call.received`;
- `call.completed`;
- `reception.dashboard.updated`.

Rooms:

```text
tenant:{tenant_id}:branch:{branch_id}:reception
tenant:{tenant_id}:branch:{branch_id}:queue
tenant:{tenant_id}:user:{user_id}:calls
```

## 17. API архитектура

REST endpoints:

```text
GET    /reception/dashboard
POST   /reception/dashboard/recalculate

GET    /reception/queue
POST   /reception/queue
PATCH  /reception/queue/:id
POST   /reception/queue/:id/call
POST   /reception/queue/:id/skip

POST   /reception/checkin
POST   /reception/visit/:appointmentId/status

POST   /reception/fast-booking/search
POST   /reception/fast-booking/suggest-slots
POST   /reception/fast-booking/create-patient
POST   /reception/fast-booking/create-appointment

GET    /reception/calls
POST   /reception/calls
PATCH  /reception/calls/:id
POST   /reception/calls/:id/create-lead

GET    /reception/invoices
POST   /reception/invoices/draft
PATCH  /reception/invoices/:id
POST   /reception/invoices/:id/mark-pending-payment
```

Realtime:

- websocket subscriptions by branch;
- dashboard patch events;
- queue updates;
- call popup events.

## 18. Permissions

Минимальные permissions:

- `reception.dashboard.read`;
- `reception.dashboard.manage`;
- `reception.fast_booking.create`;
- `reception.patient.inline_create`;
- `reception.queue.read`;
- `reception.queue.manage`;
- `reception.visit.checkin`;
- `reception.visit.status_manage`;
- `reception.calls.read`;
- `reception.calls.manage`;
- `reception.invoices.read`;
- `reception.invoices.prepare`;
- `reception.manual_override`;

Модуль также проверяет permissions нижележащих модулей:

- `patients.read/create`;
- `scheduling.appointments.create/update/cancel`;
- `scheduling.availability.read`;
- `patients.notes.manage`;
- `patients.contacts.read`;

## 19. Multi-branch логика

Администратор видит только разрешенные `branch_id`.

Dashboard:

- разделяется по филиалам;
- учитывает timezone филиала;
- не смешивает очереди разных филиалов;
- поддерживает переключение филиала, если у пользователя есть доступ к нескольким.

## 20. Audit events

Фиксировать:

- `receptionist.checkin`;
- `receptionist.fastbooking`;
- `receptionist.visit.status_changed`;
- `receptionist.manual_override`;
- `receptionist.queue.updated`;
- `call.popup.opened`;
- `call.result.changed`;
- `invoice.draft.created`;
- `invoice.pending_payment`;
- `reception.offline.sync_conflict`.

## 21. UI/UX требования

Интерфейс должен:

- работать быстро;
- поддерживать hotkeys;
- поддерживать drag-and-drop;
- иметь large clickable zones;
- быть оптимизированным под стрессовую работу;
- показывать realtime состояние без ручного обновления;
- сохранять sticky patient context;
- не блокировать dashboard call popup-ами;
- показывать conflict dialogs с понятными альтернативами.

Основные зоны экрана:

- Today’s Board;
- Fast Booking command palette;
- Call Popup;
- Patient Quick Actions;
- Queue Panel;
- Invoice Draft Panel;
- Receptionist Timeline.

## 22. Интеграция с будущими модулями

Модуль готовится к интеграции:

- `telephony` - полноценная IP-телефония;
- `finance` - платежи, кассы, фискализация;
- `loyalty` - бонусы и скидки в invoice preparation;
- `BI analytics` - KPI регистратуры;
- `queue terminals` - внешние табло и терминалы;
- `CRM automations` - follow-up и callbacks;
- `EMR` - статусы врача и завершение приема.

## 23. Module manifest

```ts
export const ReceptionistWorkplaceModuleManifest = {
  code: 'receptionist-workplace',
  name: 'Receptionist Workplace',
  version: '1.0.0',
  isCore: false,
  dependencies: [
    'auth',
    'organization-structure',
    'patient-crm',
    'smart-scheduling',
    'communications',
  ],
  permissions: [
    'reception.dashboard.read',
    'reception.dashboard.manage',
    'reception.fast_booking.create',
    'reception.patient.inline_create',
    'reception.queue.read',
    'reception.queue.manage',
    'reception.visit.checkin',
    'reception.visit.status_manage',
    'reception.calls.read',
    'reception.calls.manage',
    'reception.invoices.read',
    'reception.invoices.prepare',
    'reception.manual_override',
  ],
  events: {
    publishes: [
      'patient.checked_in',
      'visit.completed',
      'invoice.generated',
      'queue.updated',
      'call.received',
      'reception.dashboard.updated',
    ],
    subscribes: [
      'appointment.created',
      'appointment.cancelled',
      'appointment.rescheduled',
      'doctor.started_visit',
      'payment.completed',
    ],
  },
} as const;
```
