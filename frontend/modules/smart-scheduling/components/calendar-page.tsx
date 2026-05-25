'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Clock3, Filter, LogIn, X } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import type { Appointment } from '@/shared/types/bootstrap';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { DatePicker } from '@/shared/ui/date-picker';
import { useToast } from '@/shared/ui/toast';
import { CreateAppointmentForm } from './create-appointment-form';
import { WeekView } from './week-view';
import { RoomUtilizationPanel } from './room-utilization-panel';
import { useAppointments, useTransitionAppointment, useReschedule } from '../hooks/use-scheduling';

export function CalendarPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const { toast } = useToast();

  const appointments = useAppointments(branchId, selectedDate);
  const transition = useTransitionAppointment();
  const reschedule = useReschedule();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();
    socket.emit('dashboard.subscribe', { branchId });
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] });
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
  
  const generate15MinSlots = () => {
    const slots = [];
    for (let h = 8; h < 20; h++) {
      const hh = String(h).padStart(2, '0');
      slots.push(`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`);
    }
    slots.push('20:00');
    return slots;
  };
  const hours = generate15MinSlots();

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Smart scheduling</span>
          <h1>Расписание</h1>
          <p>Дневной и недельный календарь филиала, быстрые статусы визита и запись пациента в один поток.</p>
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

      <div className="schedule-shell" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        <section className="content-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
              <div>
                <p className="muted" style={{ margin: 0 }}>Первые три врача показаны как календарные колонки, полный список ниже.</p>
              </div>
            </div>
            <div className="segmented" aria-label="Вид календаря">
              <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')} type="button">День</button>
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')} type="button">Неделя</button>
            </div>
          </div>
          {appointments.isLoading ? <p className="muted">Загрузка...</p> : null}

          {view === 'week' ? (
            <WeekView bootstrap={bootstrap} selectedDate={selectedDate} branchId={branchId} />
          ) : doctorColumns.length ? (
            <div className="board-wrap">
              <div className="calendar-grid">
                <div className="calendar-head">Время</div>
                {doctorColumns.map(([doctorId, doctorAppointments]) => {
                  const emp = doctorAppointments[0]?.employee;
                  const name = emp ? `${emp.lastName} ${emp.firstName.slice(0, 1)}.` : `Врач (${doctorId.slice(0, 8)})`;
                  return (
                    <div className="calendar-head" key={doctorId}>{name}</div>
                  );
                })}
                {hours.flatMap((hour) => [
                  <div className="time-cell" key={`${hour}:time`}>{hour}</div>,
                  ...doctorColumns.map(([doctorId, doctorAppointments]) => {
                    const appointment = doctorAppointments.find((item) => formatVisitTime(item.startAt) === hour);
                    return (
                      <div
                        className="calendar-slot"
                        key={`${hour}:${doctorId}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const id = event.dataTransfer.getData('appointment/id');
                          if (id) {
                            const [hStr, mStr] = hour.split(':');
                            const targetStart = new Date(selectedDate);
                            targetStart.setHours(Number(hStr), Number(mStr), 0, 0);
                            const targetEnd = new Date(targetStart.getTime() + 30 * 60 * 1000); // preserve 30-min duration

                            reschedule.mutate({
                              id,
                              newStartAt: targetStart.toISOString(),
                              newEndAt: targetEnd.toISOString()
                            }, {
                              onSuccess: () => toast('success', 'Перенос успешен', 'Визит успешно перенесен'),
                              onError: (err: any) => toast('error', 'Ошибка переноса', err.message || 'Не удалось перенести визит')
                            });
                          }
                        }}
                      >
                        {appointment ? (
                          <div
                            className="appointment-block"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData('appointment/id', appointment.id);
                            }}
                          >
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

          {view === 'day' && (
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
          )}
        </section>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <RoomUtilizationPanel branchId={branchId} selectedDate={selectedDate} />
          <CreateAppointmentForm bootstrap={bootstrap} />
        </div>
      </div>
    </>
  );
}
