'use client';

import { useState } from 'react';
import { Activity, KeyRound, ScrollText, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can } from '@/shared/permissions/can';
import { useSystemAdminRealtime } from '../hooks/use-system-realtime';
import { GeneralTab } from './general-tab';
import { RbacTab } from './rbac-tab';
import { IntegrationsTab } from './integrations-tab';
import { AuditTab } from './audit-tab';

type TabKey = 'general' | 'rbac' | 'integrations' | 'audit';

type TabDef = {
  key: TabKey;
  label: string;
  icon: typeof SettingsIcon;
  permission: string;
  description: string;
};

const tabs: TabDef[] = [
  {
    key: 'general',
    label: 'Профиль и модули',
    icon: SettingsIcon,
    permission: 'system.settings.read',
    description: 'Имя клиники, локаль, часовой пояс, набор активных модулей'
  },
  {
    key: 'rbac',
    label: 'Роли и доступы',
    icon: ShieldCheck,
    permission: 'roles.read',
    description: 'Управление ролями, матрицей прав и назначениями сотрудников'
  },
  {
    key: 'integrations',
    label: 'Интеграции и API-ключи',
    icon: KeyRound,
    permission: 'integration.gateway.manage',
    description: 'Подключение внешних систем, ротация B2B-ключей'
  },
  {
    key: 'audit',
    label: 'Журнал безопасности',
    icon: ScrollText,
    permission: 'system.audit.read',
    description: 'Все изменения конфигурации, RBAC и интеграций с привязкой к correlation ID'
  }
];

export function SettingsPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  useSystemAdminRealtime();

  const visibleTabs = tabs.filter((tab) => can(bootstrap, tab.permission));
  const [active, setActive] = useState<TabKey>(visibleTabs[0]?.key ?? 'general');
  const activeTab = visibleTabs.find((tab) => tab.key === active) ?? visibleTabs[0];

  if (!activeTab) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <span className="eyebrow">Настройки</span>
            <h1>Системные настройки</h1>
            <p>У вашей роли недостаточно прав для управления конфигурацией клиники.</p>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page settings-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Настройки</span>
          <h1>Конфигурация клиники</h1>
          <p>{activeTab.description}</p>
        </div>
        <div className="settings-realtime">
          <Activity size={14} />
          <span>Live sync</span>
        </div>
      </header>

      <nav className="settings-tabs" role="tablist" aria-label="Разделы настроек">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`settings-tab${isActive ? ' is-active' : ''}`}
              onClick={() => setActive(tab.key)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="settings-tab-panel" role="tabpanel">
        {active === 'general' && <GeneralTab bootstrap={bootstrap} />}
        {active === 'rbac' && <RbacTab bootstrap={bootstrap} />}
        {active === 'integrations' && <IntegrationsTab bootstrap={bootstrap} />}
        {active === 'audit' && <AuditTab />}
      </div>
    </section>
  );
}
