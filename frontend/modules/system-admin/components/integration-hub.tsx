'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  IntegrationInboxEntry,
  IntegrationLogEntry,
  useIntegrationInbox,
  useIntegrationLogs,
  useIntegrationStats,
  useReplayInboxMessage,
} from '../hooks/use-integrations-hub';
import { IntegrationProvider } from '../hooks/use-system-admin';
import { useToast } from '@/shared/ui/toast';

type HubTab = 'logs' | 'inbox' | 'stats';

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU');
}

// ---------- Main component ----------

export function IntegrationHub({ providers }: { providers: IntegrationProvider[] }) {
  const [tab, setTab] = useState<HubTab>('logs');

  return (
    <section className="content-panel" style={{ marginTop: 24 }}>
      <div className="panel-header">
        <div>
          <h2>
            <Activity size={18} /> Центр интеграций
          </h2>
          <p className="muted">
            Логи запросов, входящие сообщения и статистика по всем провайдерам.
          </p>
        </div>
      </div>

      <nav className="settings-tabs" role="tablist" aria-label="Разделы хаба интеграций">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'logs'}
          className={`settings-tab${tab === 'logs' ? ' is-active' : ''}`}
          onClick={() => setTab('logs')}
        >
          <History size={16} />
          <span>Логи</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inbox'}
          className={`settings-tab${tab === 'inbox' ? ' is-active' : ''}`}
          onClick={() => setTab('inbox')}
        >
          <Inbox size={16} />
          <span>Входящие</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stats'}
          className={`settings-tab${tab === 'stats' ? ' is-active' : ''}`}
          onClick={() => setTab('stats')}
        >
          <Activity size={16} />
          <span>Статистика</span>
        </button>
      </nav>

      <div className="settings-tab-panel" role="tabpanel">
        {tab === 'logs' && <LogsSection providers={providers} />}
        {tab === 'inbox' && <InboxSection providers={providers} />}
        {tab === 'stats' && <StatsSection />}
      </div>
    </section>
  );
}

// ---------- Logs section ----------

function LogsSection({ providers }: { providers: IntegrationProvider[] }) {
  const [providerId, setProviderId] = useState('');
  const [direction, setDirection] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const debouncedProviderId = useDebounced(providerId);

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      providerId: debouncedProviderId || undefined,
      direction: direction || undefined,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
    }),
    [page, debouncedProviderId, direction, dateFrom, dateTo],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedProviderId, direction, dateFrom, dateTo]);

  const query = useIntegrationLogs(filters);
  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="audit-filters">
        <div className="field">
          <label>Провайдер</label>
          <select
            className="input"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
          >
            <option value="">Все провайдеры</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.providerName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Направление</label>
          <select
            className="input"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="">Все</option>
            <option value="INBOUND">Входящие</option>
            <option value="OUTBOUND">Исходящие</option>
          </select>
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
          <Filter size={12} /> Показаны {total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
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
            <th>Провайдер</th>
            <th>Направление</th>
            <th>Статус</th>
            <th>Время (мс)</th>
            <th>Correlation ID</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                Логов по выбранным фильтрам не найдено.
              </td>
            </tr>
          ) : (
            items.map((entry) => (
              <LogRow
                key={entry.id}
                entry={entry}
                providers={providers}
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
    </>
  );
}

function LogRow({
  entry,
  providers,
  expanded,
  onToggle,
}: {
  entry: IntegrationLogEntry;
  providers: IntegrationProvider[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const providerName =
    providers.find((p) => p.id === entry.providerId)?.providerName ?? entry.providerId ?? '—';
  const isError = entry.statusCode >= 400;

  return (
    <>
      <tr onClick={onToggle} className={`audit-row${expanded ? ' is-open' : ''}`}>
        <td>
          <time>{formatDate(entry.createdAt)}</time>
        </td>
        <td>{providerName}</td>
        <td>
          <span
            className={`settings-pill ${entry.direction === 'INBOUND' ? 'is-info' : 'is-warning'}`}
          >
            <ArrowDownUp size={10} /> {entry.direction === 'INBOUND' ? 'IN' : 'OUT'}
          </span>
        </td>
        <td>
          <span className={`settings-pill ${isError ? 'is-danger' : 'is-success'}`}>
            {entry.statusCode}
          </span>
        </td>
        <td>
          <Clock size={12} /> {entry.executionTimeMs} мс
        </td>
        <td>
          {entry.correlationId ? (
            <code className="muted">{entry.correlationId.slice(0, 12)}…</code>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      </tr>
      {expanded ? (
        <tr className="audit-row-detail">
          <td colSpan={6}>
            <div className="audit-detail-grid">
              <div>
                <strong>Запрос</strong>
                <pre>{JSON.stringify(entry.requestPayload ?? null, null, 2)}</pre>
              </div>
              <div>
                <strong>Ответ</strong>
                <pre>{JSON.stringify(entry.responsePayload ?? null, null, 2)}</pre>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ---------- Inbox section ----------

const inboxStatuses = [
  { value: '', label: 'Все статусы' },
  { value: 'RECEIVED', label: 'Получено' },
  { value: 'PROCESSED', label: 'Обработано' },
  { value: 'FAILED', label: 'Ошибка' },
  { value: 'IGNORED', label: 'Игнорировано' },
];

const statusPillClass: Record<string, string> = {
  RECEIVED: 'is-info',
  PROCESSED: 'is-success',
  FAILED: 'is-danger',
  IGNORED: 'is-warning',
};

function InboxSection({ providers }: { providers: IntegrationProvider[] }) {
  const { toast } = useToast();
  const [providerId, setProviderId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const debouncedProviderId = useDebounced(providerId);

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      providerId: debouncedProviderId || undefined,
      status: status || undefined,
    }),
    [page, debouncedProviderId, status],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedProviderId, status]);

  const query = useIntegrationInbox(filters);
  const replay = useReplayInboxMessage();

  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleReplay = (entry: IntegrationInboxEntry) => {
    replay.mutate(entry.id, {
      onSuccess: () => toast('success', 'Сообщение отправлено на повтор', entry.externalId),
      onError: (err) => toast('error', 'Не удалось повторить', err.message),
    });
  };

  return (
    <>
      <div className="audit-filters">
        <div className="field">
          <label>Провайдер</label>
          <select
            className="input"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
          >
            <option value="">Все провайдеры</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.providerName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Статус</label>
          <select
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {inboxStatuses.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="audit-meta">
        <span className="muted">
          <Filter size={12} /> Показаны {total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
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
            <th>Провайдер</th>
            <th>External ID</th>
            <th>Тип сообщения</th>
            <th>Статус</th>
            <th>Ошибка</th>
            <th aria-label="Действия" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                Входящих сообщений не найдено.
              </td>
            </tr>
          ) : (
            items.map((entry) => {
              const providerName =
                providers.find((p) => p.id === entry.providerId)?.providerName ?? entry.providerId;
              return (
                <tr key={entry.id}>
                  <td>
                    <time>{formatDate(entry.createdAt)}</time>
                  </td>
                  <td>{providerName}</td>
                  <td>
                    <code className="muted">{entry.externalId}</code>
                  </td>
                  <td>{entry.messageType}</td>
                  <td>
                    <span className={`settings-pill ${statusPillClass[entry.status] ?? ''}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    {entry.lastError ? (
                      <span className="muted" title={entry.lastError}>
                        <AlertTriangle size={12} />{' '}
                        {entry.lastError.length > 60
                          ? `${entry.lastError.slice(0, 60)}…`
                          : entry.lastError}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {entry.status === 'FAILED' ? (
                      <button
                        type="button"
                        className="ghost-button"
                        title="Повторить обработку"
                        onClick={() => handleReplay(entry)}
                        disabled={replay.isPending}
                      >
                        <RotateCw size={14} /> Повторить
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })
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
    </>
  );
}

// ---------- Stats section ----------

function StatsSection() {
  const query = useIntegrationStats();
  const stats = query.data;

  if (query.isLoading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spin" size={18} />
        <span>Загружаем статистику…</span>
      </div>
    );
  }

  if (!stats) {
    return <p className="muted">Не удалось загрузить статистику.</p>;
  }

  return (
    <>
      <div className="settings-grid-two">
        <div className="content-panel">
          <div className="panel-header">
            <div>
              <h3>
                <Activity size={16} /> Провайдеры
              </h3>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => query.refetch()}
              aria-label="Обновить"
              title="Обновить"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="settings-grid-two" style={{ padding: '0 16px 16px' }}>
            <div>
              <span className="muted">Всего</span>
              <br />
              <strong style={{ fontSize: '1.5rem' }}>{stats.totalProviders}</strong>
            </div>
            <div>
              <span className="muted">Активных</span>
              <br />
              <strong style={{ fontSize: '1.5rem' }}>{stats.activeProviders}</strong>
            </div>
          </div>
        </div>

        <div className="content-panel">
          <div className="panel-header">
            <div>
              <h3>
                <History size={16} /> Логи за 24 ч
              </h3>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <strong style={{ fontSize: '1.5rem' }}>{stats.logsLast24h}</strong>
            <span className="muted"> сообщений</span>
            {stats.logsByDirection ? (
              <div style={{ marginTop: 8 }}>
                {Object.entries(stats.logsByDirection).map(([dir, count]) => (
                  <span
                    key={dir}
                    className={`settings-pill ${dir === 'INBOUND' ? 'is-info' : 'is-warning'}`}
                    style={{ marginRight: 8 }}
                  >
                    {dir === 'INBOUND' ? 'IN' : 'OUT'}: {count}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {stats.inboxByStatus ? (
        <div className="content-panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div>
              <h3>
                <Inbox size={16} /> Входящие по статусам
              </h3>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(stats.inboxByStatus).map(([status, count]) => (
              <div key={status} style={{ textAlign: 'center' }}>
                <span className={`settings-pill ${statusPillClass[status] ?? ''}`}>{status}</span>
                <br />
                <strong>{count}</strong>
              </div>
            ))}
            {Object.keys(stats.inboxByStatus).length === 0 ? (
              <span className="muted">Нет данных о входящих сообщениях.</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
