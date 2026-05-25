# Масштабирование и эксплуатация

## 1. Runtime контуры

```text
Public Internet
  |
Nginx Ingress
  |
API Gateway
  |-- REST
  |-- GraphQL
  |-- WebSocket
  |
Backend Applications
  |-- Auth
  |-- Core API
  |-- Notifications
  |-- Integrations
  |-- Analytics
  |
Data Services
  |-- PostgreSQL
  |-- Redis
  |-- MinIO/S3
  |-- ClickHouse
```

## 2. Горизонтальное масштабирование

| Компонент     | Стратегия                                     |
| ------------- | --------------------------------------------- |
| Frontend      | Multiple replicas, CDN/static cache           |
| API Gateway   | Stateless replicas, HPA по CPU/RPS            |
| Core API      | Stateless replicas, HPA по latency/RPS        |
| WebSocket     | Replicas + Redis adapter                      |
| Notifications | Worker replicas по queue depth                |
| Integrations  | Worker replicas по queue depth и retry volume |
| Analytics     | Отдельные workers и ClickHouse ingestion      |

## 3. Вертикальное/кластерное масштабирование

| Компонент      | Стратегия                                        |
| -------------- | ------------------------------------------------ |
| PostgreSQL     | Read replicas, connection pooler, backup/restore |
| Redis          | Redis Sentinel/Cluster по мере роста             |
| ClickHouse     | Sharding/replication для аналитики               |
| Object Storage | S3-compatible lifecycle policies                 |

## 4. Observability

Обязательные сигналы:

- request latency;
- error rate;
- queue depth;
- failed jobs;
- webhook delivery status;
- DB query latency;
- Redis latency;
- WebSocket connections;
- tenant-level usage metrics;
- module-level usage metrics.

Логи должны содержать:

- `correlation_id`;
- `tenant_id`;
- `user_id`, если применимо;
- `module_code`, если применимо;
- `request_id`;
- `event_name`.

## 5. CI/CD

Pipeline GitHub Actions:

1. Install dependencies.
2. Typecheck.
3. Lint.
4. Unit tests.
5. Contract tests.
6. Prisma migration validation.
7. Build Docker images.
8. Security scan.
9. Deploy to staging.
10. Smoke tests.
11. Manual approval for production.
12. Deploy to production.

## 6. Release strategy

- Backend modules версионируются через SemVer.
- Breaking changes требуют migration guide.
- Feature flags используются для постепенного включения функционала.
- DB migrations должны быть backward-compatible при rolling deploy.
- Для тяжелых изменений используется expand/contract migration pattern.

## 7. Security baseline

- JWT access token short-lived.
- Refresh token rotation.
- 2FA для администраторов клиник и системных администраторов.
- RBAC + ACL для чувствительных действий.
- Audit log для доступа к медицинским данным.
- Rate limiting на auth, public API и webhooks.
- Tenant context обязателен для всех tenant-owned операций.
- Secrets хранятся в Kubernetes secrets или cloud secret manager.

## 8. HL7/FHIR readiness

Integration service должен содержать adapter layer:

```text
External System
  |
Protocol Adapter
  |-- HL7 adapter
  |-- FHIR adapter
  |-- REST adapter
  |-- Webhook adapter
  |
Canonical Medical Model
  |
Domain Events / Module APIs
```

FHIR-ready подход:

- внутренние модели не обязаны полностью повторять FHIR resources;
- создается mapping layer между internal DTO и FHIR-compatible resources;
- версии mapping contracts фиксируются;
- входящие сообщения валидируются и логируются;
- обработка должна быть идемпотентной.
