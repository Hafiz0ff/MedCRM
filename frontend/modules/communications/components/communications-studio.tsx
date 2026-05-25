'use client';

import { Activity, MessageSquare, Settings, BellRing } from 'lucide-react';
import React, { useState } from 'react';
import { RulesPage } from './rules-page';
import { TemplatesPage } from './templates-page';
import { BootstrapPayload } from '@/shared/types/bootstrap';

interface CommunicationsStudioProps {
  bootstrap: BootstrapPayload;
}

type ActiveTab = 'templates' | 'rules';

export function CommunicationsStudio({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('templates');

  return (
    <section className="page settings-page">
      {/* Top Premium Header */}
      <header className="page-header">
        <div>
          <span className="eyebrow">Управление</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <BellRing className="text-brand shrink-0" size={24} />
            Кабинет коммуникаций
          </h1>
          <p className="text-xs text-muted">
            Настройка автоматических триггерных уведомлений, локальных шлюзов и многоязычных
            шаблонов СМС и мессенджеров.
          </p>
        </div>
        <div className="settings-realtime flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand-soft px-2 py-1 rounded-full border border-brand-soft shadow-xs animate-pulse">
          <Activity size={12} />
          <span>Live sync active</span>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav
        className="settings-tabs flex border-b border-border mb-6"
        role="tablist"
        aria-label="Разделы кабинета коммуникаций"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          className={`settings-tab flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'border-brand text-brand font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-border'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          <MessageSquare size={15} />
          <span>Шаблоны уведомлений</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rules'}
          className={`settings-tab flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'border-brand text-brand font-bold'
              : 'border-transparent text-muted hover:text-ink hover:border-border'
          }`}
          onClick={() => setActiveTab('rules')}
        >
          <Settings size={15} />
          <span>Правила рассылок и Шлюзы</span>
        </button>
      </nav>

      {/* Tab Panels */}
      <div className="settings-tab-panel">
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'rules' && <RulesPage />}
      </div>
    </section>
  );
}
