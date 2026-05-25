import { Bell, Menu, RefreshCw, Search } from 'lucide-react';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { Sidebar } from '@/modules/shell/components/sidebar';
import { getBootstrap } from '@/shared/api/server-api';
import { AppQueryProvider } from '@/shared/query/query-provider';
import { AppearanceSelector } from '@/shared/ui/appearance-selector';
import { formatDate } from '@/shared/ui/status';

interface ProtectedLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps) {
  const { locale } = await params;
  const bootstrap = await getBootstrap();

  if (!bootstrap) {
    redirect(`/${locale}/auth/login`);
    return null;
  }

  const branch = bootstrap.branches[0];

  return (
    <div className="shell">
      <Sidebar bootstrap={bootstrap} />
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button topbar-menu"
              type="button"
              aria-label="Открыть меню"
              title="Меню"
            >
              <Menu size={18} />
            </button>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="topbar-date">{formatDate(new Date())}</span>
            <span className="topbar-branch">{branch ? branch.name : 'Филиал не выбран'}</span>
          </div>
          <label className="global-search">
            <Search size={18} />
            <input
              placeholder="Найти пациента, запись или действие"
              aria-label="Глобальный поиск"
            />
          </label>
          <div className="topbar-actions flex items-center gap-3">
            <AppearanceSelector />
            <span className="realtime-pill">
              <span className="dot" />
              Live
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label="Обновить данные"
              title="Обновить данные"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Уведомления"
              title="Уведомления"
            >
              <Bell size={18} />
              <span className="notification-dot" aria-hidden="true" />
            </button>
            <button
              className="topbar-avatar"
              type="button"
              aria-label="Профиль"
              title={bootstrap.tenant.subscriptionPlan}
            >
              АД
            </button>
          </div>
        </header>
        <AppQueryProvider>{children}</AppQueryProvider>
      </main>
    </div>
  );
}
