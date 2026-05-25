'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2, Globe2, Loader2, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can } from '@/shared/permissions/can';
import { useToast } from '@/shared/ui/toast';
import {
  useTenantModules,
  useTenantProfile,
  useUpdateTenantModule,
  useUpdateTenantProfile
} from '../hooks/use-system-admin';

const locales = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'tg', label: 'Тоҷикӣ (tg)' },
  { value: 'uz', label: 'O‘zbek (uz)' }
];

const timezones = [
  'Asia/Dushanbe',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Europe/Moscow',
  'UTC'
];

export function GeneralTab({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const { toast } = useToast();
  const canManage = can(bootstrap, 'system.settings.manage');

  const profileQuery = useTenantProfile();
  const modulesQuery = useTenantModules();
  const updateProfile = useUpdateTenantProfile();
  const updateModule = useUpdateTenantModule();

  const [name, setName] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('ru');
  const [timezone, setTimezone] = useState('Asia/Dushanbe');

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name);
      setDefaultLocale(profileQuery.data.defaultLocale);
      setTimezone(profileQuery.data.timezone);
    }
  }, [profileQuery.data]);

  const handleProfileSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    updateProfile.mutate(
      { name: name.trim(), defaultLocale, timezone },
      {
        onSuccess: () => toast('success', 'Профиль обновлён', 'Изменения применены и попадут в аудит'),
        onError: (error) => toast('error', 'Не удалось сохранить', error.message)
      }
    );
  };

  const toggleModule = (moduleCode: string, nextEnabled: boolean) => {
    if (!canManage) return;
    updateModule.mutate(
      { moduleCode, enabled: nextEnabled },
      {
        onSuccess: () =>
          toast(
            'success',
            nextEnabled ? 'Модуль включён' : 'Модуль выключен',
            'Live sync разошлёт изменение всем активным сессиям'
          ),
        onError: (error) => toast('error', 'Не удалось изменить модуль', error.message)
      }
    );
  };

  if (profileQuery.isLoading || modulesQuery.isLoading) {
    return (
      <div className="settings-loading">
        <Loader2 className="spin" size={18} />
        <span>Загружаем конфигурацию…</span>
      </div>
    );
  }

  if (profileQuery.error) {
    return <div className="error">Не удалось загрузить профиль клиники: {profileQuery.error.message}</div>;
  }

  const profile = profileQuery.data;
  const modules = modulesQuery.data ?? [];

  return (
    <div className="settings-grid">
      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>
              <Building2 size={18} /> Профиль клиники
            </h2>
            <p className="muted">Эти параметры используются всеми модулями: расписанием, EMR, FHIR-экспортом.</p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => profileQuery.refetch()}
            title="Обновить данные"
            aria-label="Обновить"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <form className="form settings-form" onSubmit={handleProfileSubmit}>
          <div className="field">
            <label htmlFor="tenant-name">Название клиники</label>
            <input
              id="tenant-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canManage}
              maxLength={255}
              required
            />
          </div>

          <div className="settings-grid-two">
            <div className="field">
              <label htmlFor="tenant-locale">Язык по умолчанию</label>
              <select
                id="tenant-locale"
                className="input"
                value={defaultLocale}
                onChange={(event) => setDefaultLocale(event.target.value)}
                disabled={!canManage}
              >
                {locales.map((locale) => (
                  <option key={locale.value} value={locale.value}>
                    {locale.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tenant-timezone">Часовой пояс</label>
              <select
                id="tenant-timezone"
                className="input"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={!canManage}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-meta">
            <span>
              <Globe2 size={14} /> Код тенанта <code>{profile?.code}</code>
            </span>
            <span>План: {profile?.subscriptionPlan}</span>
          </div>

          <div className="page-actions">
            <button type="submit" className="button" disabled={!canManage || updateProfile.isPending}>
              <Save size={16} />
              {updateProfile.isPending ? 'Сохраняем…' : 'Сохранить профиль'}
            </button>
          </div>
        </form>
      </section>

      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>Модули и feature-flags</h2>
            <p className="muted">
              Core-модули нельзя выключить — они держат аутентификацию, базовые справочники и EMR.
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => modulesQuery.refetch()}
            title="Обновить"
            aria-label="Обновить список модулей"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <ul className="settings-modules">
          {modules.map((module) => {
            const isCore = module.isCore;
            const Icon = module.enabled ? ToggleRight : ToggleLeft;
            return (
              <li key={module.moduleId} className={`settings-module${module.enabled ? ' is-on' : ''}`}>
                <div className="settings-module-meta">
                  <strong>{module.moduleName}</strong>
                  <small className="muted">
                    <code>{module.moduleCode}</code>
                    {isCore ? <span className="settings-pill is-warning">core</span> : null}
                    {module.activatedAt ? (
                      <span className="muted">с {new Date(module.activatedAt).toLocaleDateString('ru-RU')}</span>
                    ) : null}
                  </small>
                </div>
                <button
                  type="button"
                  className={`settings-toggle${module.enabled ? ' is-on' : ''}`}
                  onClick={() => toggleModule(module.moduleCode, !module.enabled)}
                  disabled={!canManage || isCore || updateModule.isPending}
                  aria-pressed={module.enabled}
                  title={isCore ? 'Core-модуль нельзя выключить' : undefined}
                >
                  <Icon size={18} />
                  <span>{module.enabled ? 'Включён' : 'Выключен'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
