# ТЗ №4. Patient CRM Core

## 1. Назначение

Модуль `patient-crm` хранит единую CRM-базу пациентов и отвечает за клиентский профиль, контакты, сегментацию, маркетинговую атрибуцию, семейные связи, юридические согласия, timeline и историю коммуникаций.

Модуль **не содержит**:

- клинические диагнозы;
- медицинские протоколы;
- назначения;
- клинические записи.

Клиническая часть реализуется отдельным EMR/clinical модулем в ТЗ №7.

## 2. Подмодули

```text
patient-crm
  |
  |-- patient-profile
  |-- contacts
  |-- crm-segmentation
  |-- lead-tracking
  |-- family-relations
  |-- legal-documents
  |-- crm-history
  |-- communication-tracking
  |-- loyalty-foundation
  |-- lifecycle-engine
  |-- duplicate-detection
  |-- patient-search
```

| Подмодуль              | Ответственность                              |
| ---------------------- | -------------------------------------------- |
| patient-profile        | Основная CRM-карточка пациента               |
| contacts               | Телефоны, email, мессенджеры, адреса         |
| crm-segmentation       | Теги, сегменты, CRM статусы                  |
| lead-tracking          | Источник заявки, UTM, конверсия              |
| family-relations       | Семейные группы, опекуны, shared loyalty     |
| legal-documents        | Согласия, договоры, шаблоны, сроки           |
| crm-history            | Timeline пациента                            |
| communication-tracking | История звонков и сообщений                  |
| loyalty-foundation     | Баланс/баллы как основа будущего loyalty     |
| lifecycle-engine       | Sleeping, retention, churn risk              |
| duplicate-detection    | Fuzzy matching и ручное подтверждение дублей |
| patient-search         | Поиск по ФИО, телефону, email, коду, семье   |

## 3. Patient Profile

Пациент является:

- CRM сущностью;
- субъектом персональных данных;
- участником маркетинговых процессов;
- единицей аналитики;
- участником программ лояльности.

Статусы:

- `NEW` - первый контакт;
- `ACTIVE` - посещал клинику;
- `SLEEPING` - нет активности X месяцев;
- `VIP` - повышенный приоритет;
- `BLOCKED` - обслуживание ограничено;
- `ARCHIVED` - архивная запись.

Статус может задаваться:

- автоматически;
- вручную администратором;
- через CRM automation rules.

## 4. Основные связи

```text
patients
  1 -- * patient_contacts
  1 -- * patient_addresses
  1 -- * patient_leads
  1 -- 1 patient_crm_metrics
  * -- * crm_tags via patient_tags
  * -- * family_groups via family_members
  1 -- * patient_legal_documents
  1 -- * patient_timeline_events
  1 -- * patient_notes
```

## 5. Таблицы

### `patients`

Основная карточка пациента.

| Поле                   | Тип         | Обязательность |
| ---------------------- | ----------- | -------------- |
| id                     | uuid        | Да             |
| tenant_id              | uuid        | Да             |
| external_id            | varchar     | Нет            |
| patient_code           | varchar     | Да             |
| first_name             | varchar     | Да             |
| last_name              | varchar     | Да             |
| middle_name            | varchar     | Нет            |
| full_name              | varchar     | Да             |
| birth_date             | date        | Нет            |
| gender                 | varchar     | Нет            |
| nationality            | varchar     | Нет            |
| language               | varchar     | Да             |
| photo_file_id          | uuid        | Нет            |
| status                 | varchar     | Да             |
| registration_branch_id | uuid        | Нет            |
| assigned_manager_id    | uuid        | Нет            |
| created_at             | timestamptz | Да             |
| updated_at             | timestamptz | Да             |
| archived_at            | timestamptz | Нет            |

### `patient_contacts`

Множественные контакты пациента.

| Поле                  | Тип     | Обязательность |
| --------------------- | ------- | -------------- |
| id                    | uuid    | Да             |
| tenant_id             | uuid    | Да             |
| patient_id            | uuid    | Да             |
| type                  | varchar | Да             |
| value                 | text    | Да             |
| value_encrypted       | bytea   | Нет            |
| normalized_value_hash | varchar | Да             |
| is_primary            | boolean | Да             |
| is_verified           | boolean | Да             |
| comment               | text    | Нет            |

Типы: `PHONE`, `EMAIL`, `TELEGRAM`, `WHATSAPP`, `INSTAGRAM`.

Контактные данные шифруются at rest. Для поиска и дедупликации используется normalized hash.

### `patient_addresses`

| Поле         | Тип     | Обязательность |
| ------------ | ------- | -------------- |
| id           | uuid    | Да             |
| tenant_id    | uuid    | Да             |
| patient_id   | uuid    | Да             |
| country      | varchar | Нет            |
| city         | varchar | Нет            |
| district     | varchar | Нет            |
| address_line | text    | Нет            |
| postal_code  | varchar | Нет            |
| is_primary   | boolean | Да             |

### `patient_leads`

Маркетинговая атрибуция и первичный источник.

| Поле             | Тип         | Обязательность |
| ---------------- | ----------- | -------------- |
| id               | uuid        | Да             |
| tenant_id        | uuid        | Да             |
| patient_id       | uuid        | Да             |
| source_type      | varchar     | Да             |
| source_name      | varchar     | Нет            |
| campaign_name    | varchar     | Нет            |
| utm_source       | varchar     | Нет            |
| utm_medium       | varchar     | Нет            |
| utm_campaign     | varchar     | Нет            |
| utm_content      | varchar     | Нет            |
| utm_term         | varchar     | Нет            |
| first_contact_at | timestamptz | Нет            |
| conversion_at    | timestamptz | Нет            |

`source_type`: `INSTAGRAM`, `TELEGRAM`, `GOOGLE`, `WEBSITE`, `REFERRAL`, `WALK_IN`.

### `patient_crm_metrics`

CRM-метрики пациента.

| Поле                | Тип         | Обязательность |
| ------------------- | ----------- | -------------- |
| id                  | uuid        | Да             |
| tenant_id           | uuid        | Да             |
| patient_id          | uuid        | Да             |
| total_visits        | integer     | Да             |
| total_revenue       | numeric     | Да             |
| ltv                 | numeric     | Да             |
| average_check       | numeric     | Да             |
| missed_appointments | integer     | Да             |
| cancellations       | integer     | Да             |
| last_visit_at       | timestamptz | Нет            |
| last_contact_at     | timestamptz | Нет            |
| retention_score     | numeric     | Нет            |
| loyalty_points      | integer     | Да             |

Метрики обновляются событиями из scheduling, finance, communications и loyalty.

### `crm_tags`

Система тегов для сегментации.

| Поле      | Тип     | Обязательность |
| --------- | ------- | -------------- |
| id        | uuid    | Да             |
| tenant_id | uuid    | Да             |
| code      | varchar | Да             |
| name      | varchar | Да             |
| color     | varchar | Нет            |
| is_system | boolean | Да             |

Примеры: `VIP`, `Child`, `Pregnancy`, `High LTV`, `Dormant`, `Corporate`, `Employee Family`.

### `patient_tags`

| Поле        | Тип         | Обязательность |
| ----------- | ----------- | -------------- |
| id          | uuid        | Да             |
| tenant_id   | uuid        | Да             |
| patient_id  | uuid        | Да             |
| tag_id      | uuid        | Да             |
| assigned_by | uuid        | Нет            |
| assigned_at | timestamptz | Да             |

### `family_groups`

Семейная группа.

| Поле                       | Тип         | Обязательность |
| -------------------------- | ----------- | -------------- |
| id                         | uuid        | Да             |
| tenant_id                  | uuid        | Да             |
| family_name                | varchar     | Да             |
| primary_contact_patient_id | uuid        | Нет            |
| shared_balance_enabled     | boolean     | Да             |
| shared_discount_enabled    | boolean     | Да             |
| created_at                 | timestamptz | Да             |

### `family_members`

| Поле                      | Тип     | Обязательность |
| ------------------------- | ------- | -------------- |
| id                        | uuid    | Да             |
| tenant_id                 | uuid    | Да             |
| family_group_id           | uuid    | Да             |
| patient_id                | uuid    | Да             |
| relation_type             | varchar | Да             |
| is_primary_contact        | boolean | Да             |
| can_receive_notifications | boolean | Да             |

`relation_type`: `MOTHER`, `FATHER`, `SON`, `DAUGHTER`, `SPOUSE`, `GUARDIAN`.

Медицинская специфика: ребенок может не иметь телефона, уведомления получает мать, оплата идет через общий семейный счет. Это требует shared communications, shared loyalty и guardian permissions.

### `legal_document_types`

| Поле                  | Тип     | Обязательность          |
| --------------------- | ------- | ----------------------- |
| id                    | uuid    | Да                      |
| tenant_id             | uuid    | Нет для системных типов |
| code                  | varchar | Да                      |
| name                  | varchar | Да                      |
| validity_period_days  | integer | Нет                     |
| requires_signature    | boolean | Да                      |
| is_required           | boolean | Да                      |
| retention_period_days | integer | Нет                     |

Примеры: `PDN_CONSENT`, `MEDICAL_SERVICE_CONTRACT`, `MARKETING_CONSENT`.

### `patient_legal_documents`

| Поле              | Тип         | Обязательность |
| ----------------- | ----------- | -------------- |
| id                | uuid        | Да             |
| tenant_id         | uuid        | Да             |
| patient_id        | uuid        | Да             |
| document_type_id  | uuid        | Да             |
| file_id           | uuid        | Да             |
| document_number   | varchar     | Нет            |
| signed_at         | timestamptz | Нет            |
| expires_at        | timestamptz | Нет            |
| retention_until   | timestamptz | Нет            |
| status            | varchar     | Да             |
| signed_by_user_id | uuid        | Нет            |
| branch_id         | uuid        | Нет            |

Статусы: `ACTIVE`, `EXPIRED`, `REVOKED`, `ARCHIVED`.

### `legal_document_templates`

| Поле             | Тип     | Обязательность |
| ---------------- | ------- | -------------- |
| id               | uuid    | Да             |
| tenant_id        | uuid    | Да             |
| document_type_id | uuid    | Да             |
| version          | varchar | Да             |
| language         | varchar | Да             |
| template_file_id | uuid    | Да             |
| is_active        | boolean | Да             |

Шаблоны версионируются. Подписание документа должно сохранять ссылку на версию шаблона или фактический файл.

### `patient_timeline_events`

Единая timeline-лента пациента.

| Поле          | Тип         | Обязательность |
| ------------- | ----------- | -------------- |
| id            | uuid        | Да             |
| tenant_id     | uuid        | Да             |
| patient_id    | uuid        | Да             |
| branch_id     | uuid        | Нет            |
| event_type    | varchar     | Да             |
| event_source  | varchar     | Да             |
| title         | varchar     | Да             |
| description   | text        | Нет            |
| metadata_json | jsonb       | Да             |
| created_by    | uuid        | Нет            |
| created_at    | timestamptz | Да             |

`event_type`: `CALL`, `MESSAGE`, `APPOINTMENT`, `PAYMENT`, `NOTE`, `TAG_ASSIGNED`, `DOCUMENT_SIGNED`.

### `patient_notes`

Внутренние CRM заметки.

| Поле       | Тип         | Обязательность |
| ---------- | ----------- | -------------- |
| id         | uuid        | Да             |
| tenant_id  | uuid        | Да             |
| patient_id | uuid        | Да             |
| note       | text        | Да             |
| visibility | varchar     | Да             |
| created_by | uuid        | Да             |
| created_at | timestamptz | Да             |

`visibility`: `PRIVATE`, `ADMIN_ONLY`, `SHARED`.

## 6. SQL baseline

```sql
create table patients (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  external_id varchar(160),
  patient_code varchar(120) not null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  middle_name varchar(120),
  full_name varchar(380) not null,
  birth_date date,
  gender varchar(40),
  nationality varchar(120),
  language varchar(10) not null default 'ru',
  photo_file_id uuid,
  status varchar(40) not null default 'NEW',
  registration_branch_id uuid references branches(id),
  assigned_manager_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, patient_code)
);

create table patient_contacts (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  type varchar(40) not null,
  value text not null,
  value_encrypted bytea,
  normalized_value_hash varchar(160) not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patient_contacts_hash
  on patient_contacts (tenant_id, type, normalized_value_hash);

create table patient_addresses (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  country varchar(120),
  city varchar(120),
  district varchar(120),
  address_line text,
  postal_code varchar(40),
  is_primary boolean not null default false
);

create table patient_leads (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  source_type varchar(80) not null,
  source_name varchar(255),
  campaign_name varchar(255),
  utm_source varchar(255),
  utm_medium varchar(255),
  utm_campaign varchar(255),
  utm_content varchar(255),
  utm_term varchar(255),
  first_contact_at timestamptz,
  conversion_at timestamptz
);

create table patient_crm_metrics (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  total_visits integer not null default 0,
  total_revenue numeric(14,2) not null default 0,
  ltv numeric(14,2) not null default 0,
  average_check numeric(14,2) not null default 0,
  missed_appointments integer not null default 0,
  cancellations integer not null default 0,
  last_visit_at timestamptz,
  last_contact_at timestamptz,
  retention_score numeric(5,2),
  loyalty_points integer not null default 0,
  unique (tenant_id, patient_id)
);

create table crm_tags (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  color varchar(40),
  is_system boolean not null default false,
  unique (tenant_id, code)
);

create table patient_tags (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  tag_id uuid not null references crm_tags(id),
  assigned_by uuid references users(id),
  assigned_at timestamptz not null default now(),
  unique (tenant_id, patient_id, tag_id)
);

create table family_groups (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  family_name varchar(255) not null,
  primary_contact_patient_id uuid references patients(id),
  shared_balance_enabled boolean not null default false,
  shared_discount_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table family_members (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  family_group_id uuid not null references family_groups(id),
  patient_id uuid not null references patients(id),
  relation_type varchar(80) not null,
  is_primary_contact boolean not null default false,
  can_receive_notifications boolean not null default false,
  unique (tenant_id, family_group_id, patient_id)
);

create table legal_document_types (
  id uuid primary key,
  tenant_id uuid references tenants(id),
  code varchar(120) not null,
  name varchar(255) not null,
  validity_period_days integer,
  requires_signature boolean not null default true,
  is_required boolean not null default false,
  retention_period_days integer,
  unique (tenant_id, code)
);

create table legal_document_templates (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  document_type_id uuid not null references legal_document_types(id),
  version varchar(80) not null,
  language varchar(10) not null,
  template_file_id uuid not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, document_type_id, version, language)
);

create table patient_legal_documents (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  document_type_id uuid not null references legal_document_types(id),
  file_id uuid not null,
  document_number varchar(120),
  signed_at timestamptz,
  expires_at timestamptz,
  retention_until timestamptz,
  status varchar(40) not null default 'ACTIVE',
  signed_by_user_id uuid references users(id),
  branch_id uuid references branches(id),
  created_at timestamptz not null default now()
);

create table patient_timeline_events (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  branch_id uuid references branches(id),
  event_type varchar(80) not null,
  event_source varchar(80) not null,
  title varchar(255) not null,
  description text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table patient_notes (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  note text not null,
  visibility varchar(40) not null default 'SHARED',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
```

## 7. Deduplication Engine

Система должна предотвращать дубли:

- phone match;
- email match;
- `birth_date + name` match;
- fuzzy matching по ФИО;
- transliteration-aware matching для RU/TJ.

Алгоритм:

```text
1. Normalize phone/email/name.
2. Check exact hashes for phone/email.
3. Check birth_date + normalized name.
4. Run fuzzy scoring.
5. Return duplicate candidates.
6. Require manual confirmation before merge.
7. Write audit event patient.duplicate.merged.
```

Merge пациента не должен физически удалять исходную запись. Используется archival link и audit trail.

## 8. Legal controls

Система должна:

- запрещать услуги без активных обязательных согласий;
- уведомлять об истечении документов;
- вести audit trail подписаний;
- поддерживать versioning шаблонов;
- хранить сроки retention;
- учитывать marketing consent при рассылках.

Публичный contract:

```ts
export type PatientLegalReadiness = {
  patientId: string;
  canReceiveServices: boolean;
  canReceiveMarketing: boolean;
  missingRequiredDocuments: string[];
  expiringDocuments: string[];
};
```

## 9. Timeline и коммуникации

Timeline объединяет:

- звонки;
- сообщения;
- визиты;
- оплаты;
- изменения профиля;
- теги;
- документы;
- заметки администратора.

Communication-tracking хранит CRM-события и ссылки на будущие communications/telephony entities. Записи звонков и voice transcription должны подключаться через file storage и metadata, не через clinical records.

## 10. Patient Lifecycle Engine

Engine автоматически:

- переводит пациента в `SLEEPING`;
- считает retention;
- определяет churn risk;
- формирует CRM сегменты;
- обновляет `patient_crm_metrics`;
- публикует события для marketing automation.

Примеры событий:

- `patient.lifecycle.sleeping_detected`;
- `patient.lifecycle.vip_detected`;
- `patient.retention_score.updated`;
- `patient.churn_risk.detected`.

## 11. Search architecture

Поиск пациентов:

- ФИО;
- телефон;
- `patient_code`;
- email;
- family members;
- `external_id`.

Требования:

- typo tolerance;
- transliteration RU/TJ;
- tenant isolation;
- branch filtering;
- encrypted contacts searchable через normalized hash;
- глобальный быстрый поиск для регистратуры.

Для MVP допускается PostgreSQL full-text + trigram indexes. При росте нагрузки можно вынести patient search в OpenSearch/Meilisearch-compatible сервис.

## 12. RLS и безопасность

Все таблицы содержат `tenant_id`.

Branch filtering применяется через:

- `registration_branch_id` у пациента;
- `branch_id` у legal documents/timeline events;
- linked appointment/payment branch из будущих модулей.

Контактные данные:

- encrypted at rest;
- masked в UI при отсутствии permissions;
- доступны для экспорта только privileged roles;
- все просмотры карточки пациента пишутся в audit при чувствительном режиме.

Архивация:

- soft-delete only через `archived_at`;
- физическое удаление запрещено;
- audit trail сохраняется.

## 13. Audit events

Фиксировать:

- `patient.created`;
- `patient.updated`;
- `patient.viewed`;
- `patient.status.changed`;
- `patient.contact.changed`;
- `patient.document.signed`;
- `patient.document.revoked`;
- `patient.tag.assigned`;
- `patient.family.updated`;
- `patient.note.created`;
- `patient.exported`;
- `patient.duplicate.merged`.

## 14. API архитектура

REST endpoints:

```text
GET    /patients
POST   /patients
GET    /patients/:id
PATCH  /patients/:id
POST   /patients/:id/archive
GET    /patients/search
GET    /patients/duplicates
POST   /patients/:id/merge

GET    /patients/:id/timeline
POST   /patients/:id/timeline

GET    /patients/:id/family
POST   /patients/:id/family
PATCH  /patients/:id/family/:memberId

GET    /patients/:id/documents
POST   /patients/:id/documents
PATCH  /patients/:id/documents/:documentId

GET    /patients/:id/tags
POST   /patients/:id/tags
DELETE /patients/:id/tags/:tagId

GET    /patients/:id/metrics
GET    /crm-tags
POST   /crm-tags
PATCH  /crm-tags/:id
```

Поддержка:

- pagination;
- filtering;
- sorting;
- global search;
- duplicate detection;
- audit metadata;
- branch filter;
- CRM segment filters.

## 15. Permissions

Минимальные permissions:

- `patients.read`;
- `patients.create`;
- `patients.update`;
- `patients.archive`;
- `patients.merge`;
- `patients.contacts.read`;
- `patients.contacts.manage`;
- `patients.documents.read`;
- `patients.documents.manage`;
- `patients.tags.manage`;
- `patients.family.manage`;
- `patients.notes.read`;
- `patients.notes.manage`;
- `patients.metrics.read`;
- `patients.export`;

## 16. UI требования

Карточка пациента:

- единое CRM окно;
- timeline справа;
- быстрые действия;
- family widget;
- CRM status badge;
- lead source indicator;
- legal status alerts;
- контакты с masking/unmask permission;
- теги и сегменты;
- заметки администратора;
- быстрый поиск и duplicate warning.

Основные экраны:

- список пациентов;
- карточка пациента;
- создание пациента;
- поиск дублей;
- семейная группа;
- юридические документы;
- CRM сегменты;
- timeline.

## 17. Интеграция с будущими модулями

Patient CRM готовится к интеграции:

- `scheduling` - визиты, пропуски, last visit;
- `finance` - платежи, LTV, average check;
- `loyalty` - баллы, семейные счета, скидки;
- `EMR` - клиническая карта, но без хранения clinical data в CRM;
- `telephony` - звонки, записи, транскрипции;
- `communications` - сообщения, доставки, marketing consent;
- `BI analytics` - retention, attribution, segments.

## 18. Module manifest

```ts
export const PatientCrmModuleManifest = {
  code: 'patient-crm',
  name: 'Patient CRM',
  version: '1.0.0',
  isCore: false,
  dependencies: ['auth', 'organization-structure', 'communications'],
  permissions: [
    'patients.read',
    'patients.create',
    'patients.update',
    'patients.archive',
    'patients.merge',
    'patients.contacts.read',
    'patients.contacts.manage',
    'patients.documents.read',
    'patients.documents.manage',
    'patients.tags.manage',
    'patients.family.manage',
    'patients.notes.read',
    'patients.notes.manage',
    'patients.metrics.read',
    'patients.export',
  ],
  events: {
    publishes: [
      'patient.created',
      'patient.updated',
      'patient.status.changed',
      'patient.document.signed',
      'patient.tag.assigned',
      'patient.lifecycle.sleeping_detected',
    ],
    subscribes: [
      'appointment.completed',
      'appointment.missed',
      'payment.completed',
      'message.delivered',
      'call.completed',
    ],
  },
} as const;
```
