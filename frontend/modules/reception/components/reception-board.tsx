'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, LogIn, PhoneCall, Search } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { useReceptionDashboard, useReceptionTransition } from '../hooks/use-reception-dashboard';

const columns = [
  { label: 'План', statuses: ['SCHEDULED', 'CONFIRMED'], dropStatus: 'CONFIRMED' },
  { label: 'Ожидают', statuses: ['CHECKED_IN'], dropStatus: 'CHECKED_IN' },
  { label: 'На приеме', statuses: ['IN_PROGRESS'], dropStatus: 'IN_PROGRESS' },
  { label: 'К оплате', statuses: ['COMPLETED_PENDING_PAYMENT'], dropStatus: 'COMPLETED_PENDING_PAYMENT' },
  { label: 'Завершено', statuses: ['COMPLETED'], dropStatus: 'COMPLETED' },
  { label: 'Отмены', statuses: ['CANCELLED', 'NO_SHOW'], dropStatus: 'CANCELLED' }
];

export function ReceptionBoard({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const dashboard = useReceptionDashboard(branchId);
  const transition = useReceptionTransition();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();
    socket.emit('dashboard.subscribe', { branchId });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
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

  if (dashboard.isLoading) return <section className="content-panel">Загрузка dashboard...</section>;
  if (dashboard.error || !dashboard.data) return <section className="content-panel error">Dashboard недоступен</section>;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Reception live board</span>
          <h1>Регистратура</h1>
          <p>Единый экран администратора для потока пациентов, очереди и быстрых переходов статуса.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" type="button">
            <Search size={17} />
            Найти пациента
          </button>
          <a className="button" href="/schedule">
            <Clock3 size={17} />
            Быстрая запись
          </a>
        </div>
      </div>

      <div className="reception-layout">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Today board</h2>
              <p className="muted">Перетащите карточку или используйте кнопки быстрых действий.</p>
            </div>
            <span className="realtime-pill"><span className="dot" /> Live</span>
          </div>
          <div className="board-wrap">
            <div className="board">
              {columns.map((column) => {
                const appointments = column.statuses.flatMap((status) => dashboard.data.columns[status] ?? []);
                return (
                  <div
                    className="board-column"
                    key={column.label}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const id = event.dataTransfer.getData('appointment/id');
                      if (id) transition.mutate({ id, status: column.dropStatus });
                    }}
                  >
                    <h3>
                      <span>{column.label}</span>
                      <span className="badge">{appointments.length}</span>
                    </h3>
                    {appointments.map((appointment) => (
                      <article
                        className="visit-card"
                        key={appointment.id}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData('appointment/id', appointment.id)}
                      >
                        <div className="visit-card-header">
                          <strong>{appointment.patient.fullName}</strong>
                          <span>{formatVisitTime(appointment.startAt)}</span>
                        </div>
                        <span>{appointment.service?.name ?? 'Визит'} · {appointment.appointmentNumber}</span>
                        <span className={`status-badge status-${statusTone(appointment.status)}`}>{statusLabel(appointment.status)}</span>
                        <button className="button" onClick={() => transition.mutate({ id: appointment.id, status: 'CHECKED_IN' })}>
                          <LogIn size={16} />
                          Отметить приход
                        </button>
                      </article>
                    ))}
                    {!appointments.length ? (
                      <div className="empty-state">
                        <div>
                          <strong>Пусто</strong>
                          <span>Нет визитов в этом статусе.</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="content-panel queue-panel">
          <div className="panel-header">
            <div>
              <h2>Очередь</h2>
              <p className="muted">Пациенты, ожидающие обработки или приема.</p>
            </div>
            <PhoneCall size={20} />
          </div>
          {dashboard.data.queue.length ? dashboard.data.queue.map((item, index) => (
            <div className="queue-row" key={item.id}>
              <strong className="queue-index">{index + 1}</strong>
              <span>{item.patient.fullName}</span>
              <span className={`status-badge status-${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
            </div>
          )) : (
            <div className="empty-state">
              <div>
                <strong>Очередь пуста</strong>
                <span>Новые check-in появятся здесь автоматически.</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
