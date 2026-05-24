import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Bell, Building2, Search, UserRound } from 'lucide-react';
import { getBootstrap } from '@/shared/api/server-api';
import { Sidebar } from '@/modules/shell/components/sidebar';
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
      <Sidebar bootstrap={bootstrap} />
      <main className="main">
        <header className="topbar">
          <div className="tenant-context">
            <span className="avatar">
              <Building2 size={18} />
            </span>
            <div>
              <strong>{bootstrap.tenant.name}</strong>
              <span>{branch ? branch.name : 'Филиал не выбран'} · {formatDate(new Date())}</span>
            </div>
          </div>
          <label className="global-search">
            <Search size={18} />
            <input placeholder="Найти пациента, запись или действие" aria-label="Глобальный поиск" />
          </label>
          <div className="topbar-actions">
            <span className="realtime-pill">
              <span className="dot" />
              Live
            </span>
            <button className="icon-button" type="button" aria-label="Уведомления" title="Уведомления">
              <Bell size={18} />
            </button>
            <button className="icon-button" type="button" aria-label="Профиль" title={bootstrap.tenant.subscriptionPlan}>
              <UserRound size={18} />
            </button>
          </div>
        </header>
        <AppQueryProvider>{children}</AppQueryProvider>
      </main>
    </div>
  );
}
