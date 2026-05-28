'use client';

import {
  KeyRound,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import {
  IntegrationProvider,
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrationProviders,
  useRotateIntegrationKey,
  useUpdateIntegration,
} from '../hooks/use-system-admin';
import { ApiKeyRevealDialog, ApiKeyRevealPayload } from './api-key-reveal';
import { IntegrationHub } from './integration-hub';
import { can } from '@/shared/permissions/can';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';

const providerTypes = [
  { value: 'FHIR', label: 'FHIR / EMR' },
  { value: 'LIS', label: 'LIS / Лаборатория' },
  { value: 'PAYMENT', label: 'Платежный шлюз' },
  { value: 'SMS', label: 'SMS / Уведомления' },
  { value: 'CUSTOM', label: 'Прочее' },
];

const authTypes = [
  { value: 'API_KEY', label: 'API key' },
  { value: 'OAUTH2', label: 'OAuth 2.0' },
  { value: 'BASIC', label: 'Basic auth' },
];

export function IntegrationsTab({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const { toast } = useToast();
  const canManage = can(bootstrap, 'integration.gateway.manage');

  const providersQuery = useIntegrationProviders();
  const createProvider = useCreateIntegration();
  const updateProvider = useUpdateIntegration();
  const rotateKey = useRotateIntegrationKey();
  const deleteProvider = useDeleteIntegration();

  const [reveal, setReveal] = useState<ApiKeyRevealPayload | null>(null);
  const [confirmRotate, setConfirmRotate] = useState<IntegrationProvider | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IntegrationProvider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    providerType: 'FHIR',
    providerCode: '',
    providerName: '',
    authenticationType: 'API_KEY',
    rateLimitPerMinute: 60,
  });

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    createProvider.mutate(
      {
        providerType: form.providerType,
        providerCode: form.providerCode.trim().toUpperCase(),
        providerName: form.providerName.trim(),
        authenticationType: form.authenticationType,
        rateLimitPerMinute: form.rateLimitPerMinute,
      },
      {
        onSuccess: (created) => {
          setShowForm(false);
          setForm({
            providerType: 'FHIR',
            providerCode: '',
            providerName: '',
            authenticationType: 'API_KEY',
            rateLimitPerMinute: 60,
          });
          setReveal({
            providerName: created.providerName,
            apiKey: created.apiKey,
            apiKeyPrefix: created.apiKeyPrefix,
            reason: 'created',
          });
          toast('success', 'Интеграция создана', created.providerName);
        },
        onError: (err) => toast('error', 'Не удалось создать', err.message),
      },
    );
  };

  const handleRotate = (provider: IntegrationProvider) => {
    rotateKey.mutate(provider.id, {
      onSuccess: (rotated) => {
        setConfirmRotate(null);
        setReveal({
          providerName: provider.providerName,
          apiKey: rotated.apiKey,
          apiKeyPrefix: rotated.apiKeyPrefix,
          reason: 'rotated',
        });
        toast('success', 'Ключ обновлён', `${provider.providerName} (${rotated.apiKeyPrefix})`);
      },
      onError: (err) => {
        toast('error', 'Не удалось обновить ключ', err.message);
        setConfirmRotate(null);
      },
    });
  };

  const handleToggleActive = (provider: IntegrationProvider) => {
    updateProvider.mutate(
      { providerId: provider.id, isActive: !provider.isActive },
      {
        onSuccess: () =>
          toast(
            'success',
            provider.isActive ? 'Интеграция выключена' : 'Интеграция включена',
            provider.providerName,
          ),
        onError: (err) => toast('error', 'Ошибка', err.message),
      },
    );
  };

  const handleDelete = (provider: IntegrationProvider) => {
    deleteProvider.mutate(provider.id, {
      onSuccess: () => {
        toast('success', 'Интеграция удалена', provider.providerName);
        setConfirmDelete(null);
      },
      onError: (err) => {
        toast('error', 'Не удалось удалить', err.message);
        setConfirmDelete(null);
      },
    });
  };

  if (providersQuery.isLoading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spin" size={18} />
        <span>Загружаем список интеграций…</span>
      </div>
    );
  }

  const providers = providersQuery.data ?? [];

  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <h2>
            <KeyRound size={18} /> Интеграции и B2B-ключи
          </h2>
          <p className="muted">
            Ключи формата <code>mck_live_*</code> привязаны к этому тенанту. Полный ключ
            показывается только в момент генерации.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => providersQuery.refetch()}
            aria-label="Обновить"
            title="Обновить"
          >
            <RefreshCw size={16} />
          </button>
          {canManage ? (
            <button type="button" className="button" onClick={() => setShowForm((value) => !value)}>
              <Plus size={14} /> Новая интеграция
            </button>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <form className="form integration-form" onSubmit={handleCreate}>
          <div className="settings-grid-two">
            <div className="field">
              <label htmlFor="provider-type">Тип</label>
              <select
                id="provider-type"
                className="input"
                value={form.providerType}
                onChange={(event) => setForm({ ...form, providerType: event.target.value })}
              >
                {providerTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="provider-auth">Аутентификация</label>
              <select
                id="provider-auth"
                className="input"
                value={form.authenticationType}
                onChange={(event) => setForm({ ...form, authenticationType: event.target.value })}
              >
                {authTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="settings-grid-two">
            <div className="field">
              <label htmlFor="provider-code">Код (UPPER_SNAKE)</label>
              <input
                id="provider-code"
                className="input"
                value={form.providerCode}
                onChange={(event) =>
                  setForm({ ...form, providerCode: event.target.value.toUpperCase() })
                }
                pattern="[A-Z0-9_]{2,}"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="provider-rate">Rate limit (req/min)</label>
              <input
                id="provider-rate"
                type="number"
                className="input"
                min={1}
                max={6000}
                value={form.rateLimitPerMinute}
                onChange={(event) =>
                  setForm({ ...form, rateLimitPerMinute: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="provider-name">Название (для UI)</label>
            <input
              id="provider-name"
              className="input"
              value={form.providerName}
              onChange={(event) => setForm({ ...form, providerName: event.target.value })}
              required
            />
          </div>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
              Отмена
            </button>
            <button
              type="submit"
              className="button"
              disabled={!canManage || createProvider.isPending}
            >
              {createProvider.isPending ? 'Создаём…' : 'Создать и выдать ключ'}
            </button>
          </div>
        </form>
      ) : null}

      {providers.length === 0 ? (
        <p className="muted settings-empty">
          Пока нет ни одной интеграции. Нажмите «Новая интеграция», чтобы выдать первый ключ.
        </p>
      ) : (
        <table className="data-table integration-table">
          <thead>
            <tr>
              <th>Провайдер</th>
              <th>Тип</th>
              <th>Ключ</th>
              <th>Rate limit</th>
              <th>Статус</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id}>
                <td>
                  <strong>{provider.providerName}</strong>
                  <br />
                  <small className="muted">
                    <code>{provider.providerCode}</code>
                  </small>
                </td>
                <td>
                  <span className="settings-pill is-info">{provider.providerType}</span>
                </td>
                <td>
                  {provider.apiKeyPrefix ? (
                    <code className="muted">{provider.apiKeyPrefix}…</code>
                  ) : (
                    <span className="muted">не выдан</span>
                  )}
                </td>
                <td>{provider.rateLimitPerMinute} / мин</td>
                <td>
                  {provider.isActive ? (
                    <span className="settings-pill is-success">активна</span>
                  ) : (
                    <span className="settings-pill is-warning">выключена</span>
                  )}
                </td>
                <td className="integration-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title={provider.isActive ? 'Выключить' : 'Включить'}
                    onClick={() => handleToggleActive(provider)}
                    disabled={!canManage || updateProvider.isPending}
                  >
                    {provider.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Ротировать ключ"
                    onClick={() => setConfirmRotate(provider)}
                    disabled={!canManage || rotateKey.isPending}
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Удалить интеграцию"
                    onClick={() => setConfirmDelete(provider)}
                    disabled={!canManage || deleteProvider.isPending}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ApiKeyRevealDialog payload={reveal} onClose={() => setReveal(null)} />

      <ConfirmDialog
        open={Boolean(confirmRotate)}
        title="Ротировать API-ключ?"
        message={`Старый ключ ${confirmRotate?.apiKeyPrefix ?? ''}… станет недействительным сразу после генерации нового. Убедитесь, что у вас есть план обновления подписанных клиентов.`}
        confirmLabel="Сгенерировать новый"
        variant="warning"
        onConfirm={() => confirmRotate && handleRotate(confirmRotate)}
        onCancel={() => setConfirmRotate(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Удалить интеграцию ${confirmDelete?.providerName ?? ''}?`}
        message="Все B2B-вызовы с этим ключом будут отклонены сразу после удаления."
        variant="danger"
        confirmLabel="Удалить"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {!canManage ? (
        <div className="settings-callout">
          <ShieldAlert size={14} /> У вас только право на чтение интеграций. Управление ключами
          требует роли с правом `integration.gateway.manage`.
        </div>
      ) : null}

      <IntegrationHub providers={providers} />
    </section>
  );
}
