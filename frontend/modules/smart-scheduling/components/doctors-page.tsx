'use client';

import { CalendarDays, Clock3 } from 'lucide-react';
import { useAppointments, useDoctors } from '../hooks/use-scheduling';
import { BootstrapPayload, Doctor } from '@/shared/types/bootstrap';
import { SkeletonCard } from '@/shared/ui/skeleton';
import { formatVisitTime } from '@/shared/ui/status';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function doctorStats(doctor: Doctor, appointments: ReturnType<typeof useAppointments>['data']) {
  const items =
    appointments?.items.filter((appointment) => appointment.employeeId === doctor.id) ?? [];
  const active = items.filter((appointment) =>
    ['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status),
  ).length;
  const completed = items.filter((appointment) => appointment.status === 'COMPLETED').length;
  const next = items.find((appointment) => new Date(appointment.startAt).getTime() >= Date.now());
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0;

  return {
    total: items.length,
    active,
    completed,
    remaining: Math.max(items.length - completed, 0),
    next,
    progress,
  };
}

export function DoctorsPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const doctors = useDoctors();
  const appointments = useAppointments(branchId, new Date());

  if (doctors.isLoading || appointments.isLoading) {
    return (
      <section className="doctors-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </section>
    );
  }

  if (doctors.error) {
    return <section className="content-panel error">Не удалось загрузить врачей</section>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Команда смены</span>
          <h1>Врачи</h1>
          <p>Загрузка врачей на сегодня, активные пациенты, остаток смены и ближайшие записи.</p>
        </div>
        <div className="page-actions">
          <a className="secondary-button" href="/schedule">
            <CalendarDays size={18} />
            Расписание
          </a>
          <a className="button" href="/schedule">
            <Clock3 size={18} />
            Записать
          </a>
        </div>
      </div>

      <section className="doctors-grid">
        {(doctors.data ?? []).map((doctor) => {
          const stats = doctorStats(doctor, appointments.data);
          return (
            <article className="doctor-card content-panel" key={doctor.id}>
              <div className="doctor-card-head">
                <span className="avatar">{initials(doctor.name)}</span>
                <div>
                  <strong>{doctor.name}</strong>
                  <span>
                    {doctor.role} · {doctor.branchName}
                  </span>
                </div>
                <span className="status-badge status-success">На смене</span>
              </div>

              <div className="doctor-card-stats">
                <div>
                  <span>Записей</span>
                  <strong>{stats.total}</strong>
                </div>
                <div>
                  <span>Принято</span>
                  <strong>{stats.completed}</strong>
                </div>
                <div>
                  <span>Осталось</span>
                  <strong>{stats.remaining}</strong>
                </div>
              </div>

              <div className="progress-line" aria-label={`Прогресс ${stats.progress}%`}>
                <span style={{ width: `${stats.progress}%` }} />
              </div>

              <div className="compact-stat">
                <span>Активных пациентов</span>
                <strong>{stats.active}</strong>
              </div>
              <div className="compact-stat">
                <span>Ближайший слот</span>
                <strong>{stats.next ? formatVisitTime(stats.next.startAt) : 'Нет'}</strong>
              </div>
            </article>
          );
        })}
      </section>

      {!doctors.data?.length ? (
        <div className="empty-state">
          <div>
            <strong>Врачи не найдены</strong>
            <span>Добавьте сотрудников или проверьте доступы текущего филиала.</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
