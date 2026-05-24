'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Clock3, Filter, LogIn, X } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import type { Appointment } from '@/shared/types/bootstrap';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { CreateAppointmentForm } from './create-appointment-form';
import { useAppointments, useTransitionAppointment } from '../hooks/use-scheduling';

export function CalendarPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const appointments = useAppointments(branchId);
  const transition = useTransitionAppointment();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();
    socket.emit('dashboard.subscribe', { branchId });
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
    };
    socket.on('appointment.created', refresh);
    socket.on('appointment.updated', refresh);
    socket.on('appointment.checked_in', refresh);
    return () => {
      socket.off('appointment.created', refresh);
      socket.off('appointment.updated', refresh);
      socket.off('appointment.checked_in', refresh);
    };
  }, [branchId, queryClient]);

  const appointmentsByDoctor = appointments.data?.items.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const doctorKey = appointment.employeeId;
    acc[doctorKey] = [...(acc[doctorKey] ?? []), appointment];
    return acc;
  }, {});
  const doctorColumns = Object.entries(appointmentsByDoctor ?? {}).slice(0, 3);
  const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Smart scheduling</span>
          <h1>Расписание</h1>
          <p>Дневной календарь филиала, быстрые статусы визита и запись пациента в один поток.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" type="button">
            <Filter size={17} />
            Фильтры
          </button>
          <a className="button" href="#create-appointment">
            <CalendarPlus size={18} />
            Создать запись
          </a>
        </div>
      </div>

      <div className="schedule-shell">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Календарь на сегодня</h2>
              <p className="muted">Первые три врача показаны как календарные колонки, полный список ниже.</p>
            </div>
            <div className="segmented" aria-label="Вид календаря">
              <button className="active" type="button">День</button>
              <button type="button">Неделя</button>
              <button type="button">Список</button>
            </div>
          </div>
        {appointments.isLoading ? <p className="muted">Загрузка...</p> : null}
          {doctorColumns.length ? (
            <div className="board-wrap">
              <div className="calendar-grid">
                <div className="calendar-head">Время</div>
                {doctorColumns.map(([doctorId, doctorAppointments]) => (
                  <div className="calendar-head" key={doctorId}>{doctorAppointments[0]?.employeeId.slice(0, 8) ?? 'Врач'}</div>
                ))}
                {hours.flatMap((hour) => [
                  <div className="time-cell" key={`${hour}:time`}>{hour}</div>,
                  ...doctorColumns.map(([doctorId, doctorAppointments]) => {
                    const appointment = doctorAppointments.find((item) => formatVisitTime(item.startAt).startsWith(hour.slice(0, 2)));
                    return (
                      <div className="calendar-slot" key={`${hour}:${doctorId}`}>
                        {appointment ? (
                          <div className="appointment-block">
                            <strong>{formatVisitTime(appointment.startAt)} · {appointment.patient.fullName}</strong>
                            <span>{appointment.service?.name ?? 'Без услуги'}</span>
                            <span className={`status-badge status-${statusTone(appointment.status)}`}>
                              {statusLabel(appointment.status)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ])}
              </div>
            </div>
          ) : !appointments.isLoading ? (
            <div className="empty-state">
              <div>
                <strong>На сегодня записей нет</strong>
                <span>Создайте первую запись или измените фильтры филиала.</span>
              </div>
            </div>
          ) : null}

          <div className="section-gap">
            <div className="panel-header">
              <div>
                <h3>Все записи</h3>
                <p className="muted">Быстрые действия доступны без открытия карточки.</p>
              </div>
            </div>
            <div className="list">
              {appointments.data?.items.map((appointment) => (
                <div className="row" key={appointment.id}>
                  <div className="visit-card-header">
                    <strong><Clock3 size={16} /> {formatVisitTime(appointment.startAt)} · {appointment.patient.fullName}</strong>
                    <span className={`status-badge status-${statusTone(appointment.status)}`}>{statusLabel(appointment.status)}</span>
                  </div>
                  <span className="muted">{appointment.service?.name ?? 'Без услуги'} · {appointment.appointmentNumber}</span>
                  <div className="inline-actions">
                    <button className="secondary-button" onClick={() => transition.mutate({ id: appointment.id, action: 'confirm' })}>
                      <Check size={16} />
                      Подтвердить
                    </button>
                    <button className="secondary-button" onClick={() => transition.mutate({ id: appointment.id, action: 'check-in' })}>
                      <LogIn size={16} />
                      Отметить приход
                    </button>
                    <button className="secondary-button" onClick={() => transition.mutate({ id: appointment.id, action: 'cancel' })}>
                      <X size={16} />
                      Отменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <CreateAppointmentForm bootstrap={bootstrap} />
      </div>
    </>
  );
}
