import { Activity, AlertTriangle, CalendarCheck, Clock3, Plus, Users } from 'lucide-react';
import { getBootstrap } from '@/shared/api/server-api';

export default async function DashboardPage() {
  const bootstrap = await getBootstrap();
  const moduleCount = bootstrap?.enabledModules.length ?? 0;
  const permissionCount = bootstrap?.permissions.length ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Сегодня</span>
          <h1>Операционная панель</h1>
          <p>Короткий обзор потока пациентов, расписания и готовности клиники к смене.</p>
        </div>
        <div className="page-actions">
          <a className="secondary-button" href="/patients">
            <Users size={18} />
            Пациенты
          </a>
          <a className="button" href="/schedule">
            <Plus size={18} />
            Новая запись
          </a>
        </div>
      </div>

      <section className="dashboard-grid" aria-label="Ключевые показатели">
        <article className="metric-card">
          <span>Записи сегодня</span>
          <strong>24</strong>
          <small>18 подтверждены, 3 ожидают звонка</small>
        </article>
        <article className="metric-card">
          <span>Пациенты в клинике</span>
          <strong>7</strong>
          <small>2 ожидают администратора</small>
        </article>
        <article className="metric-card">
          <span>Загрузка врачей</span>
          <strong>76%</strong>
          <small>Пик с 14:00 до 17:00</small>
        </article>
        <article className="metric-card">
          <span>Активные модули</span>
          <strong>{moduleCount}</strong>
          <small>{permissionCount} прав в текущей роли</small>
        </article>
      </section>

      <div className="workspace-grid">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Ближайшие события</h2>
              <p className="muted">Операционные задачи, которые требуют внимания в течение смены.</p>
            </div>
            <span className="status-badge status-success">Live</span>
          </div>
          <div className="list">
            <article className="row">
              <div className="visit-card-header">
                <strong><Clock3 size={16} /> 10:30 · Первичный прием</strong>
                <span className="status-badge status-info">Подтвержден</span>
              </div>
              <span className="muted">Пациент: Азизова Мадина · Врач: Кардиолог · Кабинет 204</span>
            </article>
            <article className="row">
              <div className="visit-card-header">
                <strong><AlertTriangle size={16} /> Возможный конфликт ресурса</strong>
                <span className="status-badge status-warning">Проверить</span>
              </div>
              <span className="muted">УЗИ кабинет запланирован на две процедуры в 12:00.</span>
            </article>
            <article className="row">
              <div className="visit-card-header">
                <strong><CalendarCheck size={16} /> Окно для записи</strong>
                <span className="status-badge status-neutral">14:40</span>
              </div>
              <span className="muted">Свободный слот у терапевта подходит пациентам из листа ожидания.</span>
            </article>
          </div>
        </section>

        <aside className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Состояние системы</h2>
              <p className="muted">Tenant, RBAC и realtime готовы к работе.</p>
            </div>
            <Activity size={20} />
          </div>
          <div className="list">
            <div className="row">
              <strong>{bootstrap?.tenant.name}</strong>
              <span className="muted">{bootstrap?.tenant.subscriptionPlan} · {bootstrap?.tenant.locale.toUpperCase()}</span>
            </div>
            <div className="row">
              <strong>Филиалы</strong>
              <span className="muted">{bootstrap?.branches.map((branch) => branch.name).join(', ') || 'Не выбраны'}</span>
            </div>
            <div className="row">
              <strong>Модули</strong>
              <span className="muted">{bootstrap?.enabledModules.join(', ')}</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
