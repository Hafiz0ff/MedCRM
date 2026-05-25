# ТЗ №1. Базовая модульная архитектура MedCRM

## 1. Назначение

MedCRM проектируется как cloud-first SaaS CRM/МИС платформа для частных клиник. Архитектура должна поддерживать multi-tenant модель, динамическое подключение модулей, независимое масштабирование сервисов, audit-ready безопасность и готовность к HL7/FHIR интеграциям.

Базовый архитектурный стиль: **Modular Monolith + Microservice-ready**.

Причины выбора:

- MVP быстрее выпускать и сопровождать в едином репозитории и runtime-контуре.
- Бизнес-модули изолированы по границам домена.
- Модули общаются через события и публичные контракты, а не прямые импорты внутренних классов.
- Высоконагруженные или организационно независимые части можно вынести в отдельные сервисы без переписывания ядра.

## 2. Базовый стек

### Frontend

| Область   | Технология               |
| --------- | ------------------------ |
| Framework | Next.js 16, App Router   |
| Language  | TypeScript               |
| UI        | TailwindCSS, shadcn/ui   |
| State     | Zustand, TanStack Query  |
| Forms     | React Hook Form, Zod     |
| i18n      | next-intl, минимум RU/TJ |
| PWA       | next-pwa                 |
| Charts    | ECharts                  |
| Realtime  | Socket.IO Client         |

### Backend

| Область    | Технология            |
| ---------- | --------------------- |
| Runtime    | Node.js 24 LTS        |
| Framework  | NestJS                |
| Language   | TypeScript            |
| ORM        | Prisma ORM            |
| API        | REST + GraphQL        |
| Queue      | BullMQ + Redis        |
| Realtime   | Socket.IO             |
| Validation | Zod / class-validator |

### Data Layer

| Назначение                           | Технология    |
| ------------------------------------ | ------------- |
| Primary DB                           | PostgreSQL 17 |
| Cache / Queue / Session coordination | Redis         |
| Object storage                       | MinIO / S3    |
| Analytics                            | ClickHouse    |

### Infrastructure

| Область          | Технология           |
| ---------------- | -------------------- |
| Containerization | Docker               |
| Orchestration    | Kubernetes           |
| Ingress          | Nginx Ingress        |
| CI/CD            | GitHub Actions       |
| IaC              | Terraform            |
| Metrics          | Prometheus + Grafana |
| Logs             | Loki                 |
| Errors           | Sentry               |

### Security

| Область          | Подход                                    |
| ---------------- | ----------------------------------------- |
| Auth             | JWT Access/Refresh, OAuth2                |
| MFA              | 2FA                                       |
| Authorization    | RBAC + ACL                                |
| Audit            | Immutable audit events                    |
| Tenant isolation | PostgreSQL RLS + mandatory tenant context |

### Integration Layer

| Область     | Подход                                              |
| ----------- | --------------------------------------------------- |
| API Gateway | Единая точка входа REST/GraphQL/WebSocket           |
| Webhooks    | Подписки, ретраи, подписи, delivery log             |
| HL7         | Adapter-ready ingestion/export                      |
| FHIR        | Resource-oriented contracts, FHIR-ready DTO mapping |

## 3. Архитектурные слои

```text
Clients
  Web / PWA / Mobile
    |
API Gateway
  REST / GraphQL / WebSocket
    |
Core Platform
  Auth, Tenancy, RBAC, Audit, Feature Flags, Events, Localization
    |
Business Modules
  Patient CRM, Scheduling, Finance, Registry, Labs, Communications, etc.
    |
Data / Integration Layer
  PostgreSQL, Redis, S3/MinIO, ClickHouse, HL7/FHIR, Webhooks
```

## 4. Границы ядра и модулей

Ядро платформы содержит только общие механизмы:

- tenant context и tenant resolution;
- authentication и session lifecycle;
- RBAC/ACL и permission evaluation;
- audit logging;
- module registry;
- feature flags;
- localization;
- event bus;
- cache и common utilities;
- database access primitives.

Бизнес-логика клиники живет в модулях. Новый модуль должен подключаться через публичный manifest и контракты, без изменения ядра.

## 5. Базовые бизнес-модули

| Модуль            | Назначение                                          |
| ----------------- | --------------------------------------------------- |
| patient-crm       | Карточка пациента, история взаимодействий, сегменты |
| scheduling        | Расписание, слоты, визиты, подтверждения            |
| doctors-workplace | Рабочее место врача, приемы, назначения             |
| registry          | Регистратура, поток пациентов                       |
| finance           | Счета, платежи, касса, задолженности                |
| warehouse         | Склад, материалы, остатки                           |
| communications    | SMS/Email/мессенджеры, шаблоны                      |
| telephony         | Интеграции телефонии, звонки                        |
| laboratories      | Лабораторные заявки и результаты                    |
| analytics         | BI, отчеты, витрины                                 |
| loyalty           | Бонусы, скидки, программы лояльности                |
| marketing         | Кампании, воронки, рассылки                         |
| documents         | Документы, шаблоны, печатные формы                  |
| files-storage     | Файлы, вложения, медиа                              |
| integrations      | HL7/FHIR, webhooks, внешние API                     |

## 6. Модульное подключение

Каждая клиника имеет:

- `tenant_id`;
- `subscription_plan`;
- список активных модулей;
- конфигурацию модулей;
- набор feature flags;
- карту прав доступа.

При авторизации:

1. API Gateway определяет tenant по домену, заголовку или маршруту.
2. Auth service валидирует пользователя и сессию.
3. Tenancy core загружает tenant profile.
4. Module registry загружает активные модули tenant-а.
5. Permission service строит permissions map.
6. Feature flag service возвращает доступные фичи.
7. Frontend скрывает недоступные разделы.
8. Backend guards/middleware блокируют отключенные модули и права.

## 7. Feature Flag архитектура

Допускается два варианта:

- LaunchDarkly-compatible internal API;
- собственный Internal Feature Flag Service.

Базовые возможности:

- включение модулей без деплоя;
- beta rollout;
- A/B testing;
- ограничения по тарифу;
- targeting по tenant, user, role, region;
- audit изменений флагов;
- rollback значения флага.

Feature flags не заменяют RBAC. Флаг управляет доступностью функциональности, RBAC управляет правом пользователя выполнять действие.

## 8. Multi-tenancy

Базовый подход: **Shared DB + tenant_id isolation**.

Все tenant-owned таблицы обязаны содержать:

- `tenant_id`;
- `created_by`;
- `updated_by`;
- `created_at`;
- `updated_at`;
- опционально `deleted_at` для soft delete.

На уровне PostgreSQL включается Row Level Security. Backend обязан устанавливать tenant context для каждого запроса к БД.

## 9. Event-driven взаимодействие

Модули публикуют domain events в event bus. Другие модули подписываются на события через публичные контракты.

Примеры событий:

- `patient.created`;
- `patient.updated`;
- `appointment.confirmed`;
- `appointment.cancelled`;
- `payment.completed`;
- `document.generated`;
- `lab.result.received`.

Правило: модуль не импортирует внутренние сервисы другого модуля. Для синхронного доступа используются публичные application services/contracts, для асинхронного - events.

## 10. Масштабирование

Горизонтально масштабируются:

- API Gateway;
- backend API instances;
- WebSocket gateway;
- notification workers;
- integration workers;
- analytics workers;
- frontend runtime.

Вертикально и/или кластерно масштабируются:

- PostgreSQL;
- Redis;
- ClickHouse.

Для WebSocket используется Redis adapter, чтобы события доставлялись между несколькими backend instances.

## 11. Отказоустойчивость

Минимальные требования:

- stateless API instances;
- health/readiness probes;
- retry policy для queues/webhooks/integrations;
- dead letter queues;
- database backups и restore drills;
- object storage versioning;
- graceful shutdown;
- idempotency keys для платежей, webhooks и интеграций;
- correlation ID во всех логах и audit events.

## 12. Стандарты разработки

- Clean Architecture;
- SOLID;
- DDD-lite;
- feature-based structure;
- OpenAPI/Swagger;
- GraphQL schema contracts;
- ESLint;
- Prettier;
- Husky;
- Conventional Commits;
- contract tests для публичных модульных интерфейсов;
- migration review для PostgreSQL схемы и RLS policy.

## 13. Архитектурные артефакты

- [Backend tree-схема](./backend-tree.md)
- [Frontend tree-схема](./frontend-tree.md)
- [Модульность, multi-tenancy и DB модель](./modularity-tenancy-db.md)
- [Auth, RBAC и branch-level permissions](./auth-rbac.md)
- [Организационная структура клиники](./organization-structure.md)
- [Единая база пациентов Patient CRM Core](./patient-crm-core.md)
- [Умное расписание и модуль записи](./smart-scheduling.md)
- [АРМ администратора клиники](./receptionist-workplace.md)
- [Правила масштабирования и эксплуатации](./scaling-operations.md)
