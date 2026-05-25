'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Activity, CalendarPlus, ClipboardList, Clock3, Users } from 'lucide-react';
import { useEffect } from 'react';
import {
  useReceptionDashboard,
  type ReceptionAppointment,
} from '@/modules/reception/hooks/use-reception-dashboard';
import { useRoomUtilization } from '@/modules/smart-scheduling/hooks/use-scheduling';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { SkeletonCard, SkeletonTable } from '@/shared/ui/skeleton';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';

type DoctorLoad = {
  name: string;
  total: number;
  active: number;
  completed: number;
};

function sortedAppointments(columns: Record<string, ReceptionAppointment[]>) {
  return Object.values(columns)
    .flat()
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function doctorLoads(appointments: ReceptionAppointment[]): DoctorLoad[] {
  const loads = new Map<string, DoctorLoad>();

  appointments.forEach((appointment) => {
    const name = appointment.doctorName ?? 'Врач не назначен';
    const current = loads.get(name) ?? { name, total: 0, active: 0, completed: 0 };
    current.total += 1;
    if (['CHECKED_IN', 'IN_PROGRESS'].includes(appointment.status)) current.active += 1;
    if (appointment.status === 'COMPLETED') current.completed += 1;
    loads.set(name, current);
  });

  return Array.from(loads.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function DashboardView({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dashboard = useReceptionDashboard(branchId);
  const utilization = useRoomUtilization(branchId, todayStr, todayStr);

  useEffect(() => {
    if (!branchId) return;
    const socket = getRealtimeSocket();
    socket.emit('dashboard.subscribe', { branchId });

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['room-utilization'] });
    };

    socket.on('appointment.created', refresh);
    socket.on('appointment.updated', refresh);
    socket.on('appointment.checked_in', refresh);
    socket.on('dashboard.updated', refresh);

    return () => {
      socket.off('appointment.created', refresh);
      socket.off('appointment.updated', refresh);
      socket.off('appointment.checked_in', refresh);
      socket.off('dashboard.updated', refresh);
    };
  }, [branchId, queryClient]);

  if (dashboard.isLoading || utilization.isLoading) {
    return (
      <div className="section-gap">
        <section className="dashboard-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </section>
        <div className="section-gap">
          <SkeletonTable rows={6} />
        </div>
      </div>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <div className="content-panel error">Не удалось загрузить данные операционной панели</div>
    );
  }

  const { counters, columns, queue } = dashboard.data;
  const appointments = sortedAppointments(columns);
  const visibleAppointments = appointments.slice(0, 7);
  const doctors = doctorLoads(appointments);
  const rooms = utilization.data ?? [];
  const averageRoomLoad = rooms.length
    ? Math.round(rooms.reduce((sum, room) => sum + room.utilizationPercent, 0) / rooms.length)
    : 0;

  const metrics = [
    {
      label: 'Записи сегодня',
      value: counters.total,
      hint: `${counters.waiting} в плане`,
      href: '/schedule',
    },
    {
      label: 'Ожидают',
      value: counters.checkedIn,
      hint: `${queue.length} в очереди`,
      href: '/reception',
    },
    { label: 'На приёме', value: counters.inProgress, hint: 'у врача сейчас', href: '/reception' },
    {
      label: 'К оплате',
      value: counters.completedPendingPayment,
      hint: 'ждут кассу',
      href: '/reception',
    },
    { label: 'Завершено', value: counters.completed, hint: 'визитов закрыто', href: '/patients' },
    {
      label: 'Отмены',
      value: counters.cancelled + counters.noShow,
      hint: `${counters.noShow} не пришли`,
      href: '/schedule',
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Операционный день</span>
          <h1>Операционная</h1>
          <p>
            Единый экран смены: записи, очередь, врачи, кабинеты и точки внимания администратора.
          </p>
        </div>
        <div className="page-actions">
          <a className="secondary-button" href="/reception">
            <ClipboardList size={18} />
            Очередь
          </a>
          <a className="button" href="/schedule">
            <CalendarPlus size={18} />
            Записать
          </a>
        </div>
      </div>

      <section className="dashboard-grid" aria-label="Ключевые показатели смены">
        {metrics.map((metric) => (
          <a className="metric-card clickable" href={metric.href} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.hint}</small>
          </a>
        ))}
      </section>

      <div className="dashboard-main-grid">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Ближайшие записи</h2>
              <p className="muted">Пациенты и задачи, которые формируют текущую смену.</p>
            </div>
            <span className="realtime-pill">
              <span className="dot" />
              Live
            </span>
          </div>

          <div className="operations-list">
            {visibleAppointments.length ? (
              visibleAppointments.map((appointment) => (
                <article className="operations-row" key={appointment.id}>
                  <div className="operations-time">{formatVisitTime(appointment.startAt)}</div>
                  <div>
                    <strong>{appointment.patientName}</strong>
                    <span>{appointment.patientCode}</span>
                  </div>
                  <div>
                    <strong>
                      {appointment.service?.name ?? appointment.appointmentType ?? 'Приём'}
                    </strong>
                    <span>{appointment.roomName ?? 'Кабинет не назначен'}</span>
                  </div>
                  <div>
                    <strong>{appointment.doctorName ?? 'Врач не назначен'}</strong>
                    <span>{appointment.phone ?? 'Телефон не указан'}</span>
                  </div>
                  <span className={`status-badge status-${statusTone(appointment.status)}`}>
                    {statusLabel(appointment.status)}
                  </span>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <div>
                  <strong>На сегодня записей нет</strong>
                  <span>Создайте первую запись или измените фильтр филиала.</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="side-stack">
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <h2>Врачи сегодня</h2>
                <p className="muted">Загрузка и прогресс приёмов.</p>
              </div>
              <Users size={18} className="muted" />
            </div>
            {doctors.length ? (
              doctors.map((doctor) => {
                const progress = doctor.total
                  ? Math.round((doctor.completed / doctor.total) * 100)
                  : 0;
                return (
                  <article className="doctor-load-card" key={doctor.name}>
                    <span className="avatar">{initials(doctor.name)}</span>
                    <div>
                      <strong>{doctor.name}</strong>
                      <span>
                        {doctor.active} активных · {doctor.completed} завершено
                      </span>
                      <div className="progress-line" aria-hidden="true">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <strong>{doctor.total}</strong>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <div>
                  <strong>Нет назначений</strong>
                  <span>Врачи появятся после создания записей.</span>
                </div>
              </div>
            )}
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <div>
                <h2>Состояние смены</h2>
                <p className="muted">Очередь, кабинеты и активные модули.</p>
              </div>
              <Activity size={18} className="muted" />
            </div>
            <div>
              <div className="compact-stat">
                <span>В очереди</span>
                <strong>{queue.length}</strong>
              </div>
              <div className="compact-stat">
                <span>Средняя загрузка кабинетов</span>
                <strong>{averageRoomLoad}%</strong>
              </div>
              <div className="compact-stat">
                <span>Активные модули</span>
                <strong>{bootstrap.enabledModules.length}</strong>
              </div>
              <div className="compact-stat">
                <span>Права роли</span>
                <strong>{bootstrap.permissions.length}</strong>
              </div>
            </div>
            {rooms.length ? (
              <div className="section-gap">
                {rooms.slice(0, 3).map((room) => (
                  <div className="compact-stat" key={room.roomId}>
                    <span>{room.roomName}</span>
                    <strong>{room.utilizationPercent}%</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
