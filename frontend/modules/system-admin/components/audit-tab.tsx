'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Loader2, ScrollText } from 'lucide-react';
import { AuditFilters, AuditLogEntry, useAuditLog } from '../hooks/use-system-admin';

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

const knownActions = [
  '',
  'system.tenant.profile.updated',
  'system.tenant.module.updated',
  'system.role.created',
  'system.role.updated',
  'system.role.deleted',
  'system.role.permissions.updated',
  'system.user.roles.updated',
  'system.integration.provider.created',
  'system.integration.provider.updated',
  'system.integration.provider.deleted',
  'system.integration.provider.key.rotated'
];

export function AuditTab() {
  const [action, setAction] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const debouncedUserId = useDebounced(userIdInput);
  const debouncedAction = useDebounced(action);
  const debouncedEntityType = useDebounced(entityType);

  const filters: AuditFilters = useMemo(
    () => ({
      action: debouncedAction || undefined,
      userId: debouncedUserId || undefined,
      entityType: debouncedEntityType || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
      page,
      pageSize: PAGE_SIZE
    }),
    [debouncedAction, debouncedUserId, debouncedEntityType, dateFrom, dateTo, page]
  );

  // Reset to page 1 whenever filters (other than `page`) change.
  useEffect(() => {
    setPage(1);
  }, [debouncedAction, debouncedUserId, debouncedEntityType, dateFrom, dateTo]);

  const query = useAuditLog(filters);

  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <h2>
            <ScrollText size={18} /> Журнал безопасности
          </h2>
          <p className="muted">
            Все изменения конфигурации, RBAC и интеграций. Привязаны к correlation ID запроса.
          </p>
        </div>
      </div>

      <div className="audit-filters">
        <div className="field">
          <label>Действие</label>
          <select className="input" value={action} onChange={(event) => setAction(event.target.value)}>
            {knownActions.map((opt) => (
              <option key={opt} value={opt}>
                {opt || 'Все действия'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>User ID</label>
          <input
            className="input"
            placeholder="UUID сотрудника"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Сущность</label>
          <input
            className="input"
            placeholder="tenant, role, user…"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          />
        </div>
        <div className="field">
          <label>С</label>
          <input
            type="datetime-local"
            className="input"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div className="field">
          <label>По</label>
          <input
            type="datetime-local"
            className="input"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      <div className="audit-meta">
        <span className="muted">
          <Filter size={12} /> Показаны {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, total)} из {total}
        </span>
        {query.isFetching ? (
          <span className="muted">
            <Loader2 className="spin" size={12} /> обновляется…
          </span>
        ) : null}
      </div>

      <table className="data-table audit-table">
        <thead>
          <tr>
            <th>Время</th>
            <th>Действие</th>
            <th>Сущность</th>
            <th>Пользователь</th>
            <th>Correlation</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Под фильтр ничего не попало.
              </td>
            </tr>
          ) : (
            items.map((entry) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                expanded={expanded === entry.id}
                onToggle={() => setExpanded((prev) => (prev === entry.id ? null : entry.id))}
              />
            ))
          )}
        </tbody>
      </table>

      <div className="audit-pagination">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || query.isFetching}
        >
          <ChevronLeft size={14} /> Назад
        </button>
        <span className="muted">
          стр. {page} из {totalPages}
        </span>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || query.isFetching}
        >
          Вперёд <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}

function AuditRow({
  entry,
  expanded,
  onToggle
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className={`audit-row${expanded ? ' is-open' : ''}`}>
        <td>
          <time>{new Date(entry.createdAt).toLocaleString('ru-RU')}</time>
        </td>
        <td>
          <code>{entry.action}</code>
        </td>
        <td>
          {entry.entityType ? <code>{entry.entityType}</code> : <span className="muted">—</span>}
          {entry.entityId ? (
            <small className="muted">
              <br />
              {entry.entityId.slice(0, 8)}…
            </small>
          ) : null}
        </td>
        <td>{entry.userEmail ?? <span className="muted">system</span>}</td>
        <td>
          <code className="muted">{entry.requestId.slice(0, 12)}…</code>
        </td>
      </tr>
      {expanded ? (
        <tr className="audit-row-detail">
          <td colSpan={5}>
            <div className="audit-detail-grid">
              <div>
                <strong>Старое значение</strong>
                <pre>{JSON.stringify(entry.oldValuesJson ?? null, null, 2)}</pre>
              </div>
              <div>
                <strong>Новое значение</strong>
                <pre>{JSON.stringify(entry.newValuesJson ?? null, null, 2)}</pre>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
