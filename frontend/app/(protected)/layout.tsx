import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Bell, RefreshCw, Search } from 'lucide-react';
import { getBootstrap } from '@/shared/api/server-api';
import { TopNav } from '@/modules/shell/components/top-nav';
import { AppQueryProvider } from '@/shared/query/query-provider';
import { formatDate } from '@/shared/ui/status';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const bootstrap = await getBootstrap();
  if (!bootstrap) {
    redirect('/auth/login');
  }

  const branch = bootstrap.branches[0];

  return (
    <div className="shell">
      <TopNav bootstrap={bootstrap} />
      <div className="context-bar">
        <div className="context-bar-inner">
          <div className="context-left">
            <span className="context-date">{formatDate(new Date())}</span>
            <span className="context-divider" aria-hidden="true" />
            <span className="context-branch">{branch ? branch.name : 'Филиал не выбран'}</span>
          </div>
          <label className="global-search">
            <Search size={16} />
            <input placeholder="Найти пациента, запись или действие" aria-label="Глобальный поиск" />
            <kbd className="global-search-kbd" aria-hidden="true">⌘K</kbd>
          </label>
          <div className="context-actions">
            <span className="realtime-pill" title="Соединение в реальном времени">
              <span className="dot" />
              Live
            </span>
            <button className="icon-button" type="button" aria-label="Обновить данные" title="Обновить данные">
              <RefreshCw size={16} />
            </button>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Уведомления"
              title="Уведомления"
            >
              <Bell size={16} />
              <span className="notification-dot" aria-hidden="true" />
            </button>
            <button className="topbar-avatar" type="button" aria-label="Профиль" title={bootstrap.tenant.subscriptionPlan}>
              АД
            </button>
          </div>
        </div>
      </div>
      <main className="main">
        <AppQueryProvider>{children}</AppQueryProvider>
      </main>
    </div>
  );
}
