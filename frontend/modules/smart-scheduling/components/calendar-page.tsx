'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus,
  Clock3,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  useAppointments,
  useTransitionAppointment,
  useReschedule,
  useDoctors,
} from '../hooks/use-scheduling';
import { CreateAppointmentForm } from './create-appointment-form';
import { RoomUtilizationPanel } from './room-utilization-panel';
import { WeekView } from './week-view';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import type { Appointment } from '@/shared/types/bootstrap';
import { DatePicker } from '@/shared/ui/date-picker';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { useToast } from '@/shared/ui/toast';

export function CalendarPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const { toast } = useToast();

  const appointments = useAppointments(branchId, selectedDate);
  const doctorsQuery = useDoctors();
  const transition = useTransitionAppointment();
  const reschedule = useReschedule();
  const queryClient = useQueryClient();

  const [prefilledDoctorId, setPrefilledDoctorId] = useState('');
  const [prefilledTime, setPrefilledTime] = useState('');

  useEffect(() => {
    if (!branchId) return;
    const socket = getRealtimeSocket();
    socket.emit('dashboard.subscribe', { branchId });
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-week'] });
      queryClient.invalidateQueries({ queryKey: ['reception-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['room-utilization'] });
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

  const doctors = doctorsQuery.data || [];

  // Generate slots every 30 minutes from 08:00 to 20:00
  const generateSlots = () => {
    const slots = [];
    for (let h = 8; h < 20; h++) {
      const hh = String(h).padStart(2, '0');
      slots.push(`${hh}:00`, `${hh}:30`);
    }
    slots.push('20:00');
    return slots;
  };
  const timeSlots = generateSlots();

  // Helper to change date by offset
  const handleDateOffset = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const handleSlotClick = (doctorId: string, hourStr: string) => {
    const [h, m] = hourStr.split(':');
    const d = new Date(selectedDate);
    d.setHours(Number(h), Number(m), 0, 0);

    // Format local ISO string for datetime-local (YYYY-MM-DDTHH:mm)
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setPrefilledDoctorId(doctorId);
    setPrefilledTime(localISOTime);

    toast('info', 'Время выбрано', `Врач и время ${hourStr} автоматически подставлены в форму`);

    const formEl = document.getElementById('create-appointment');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Find if slot has overlapping (conflicting) appointments
  const getSlotAppointments = (doctorId: string, timeHour: string) => {
    const apps =
      appointments.data?.items.filter((item) => {
        if (item.employeeId !== doctorId) return false;
        const appStart = new Date(item.startAt);
        const [h, m] = timeHour.split(':');
        const slotTime = new Date(selectedDate);
        slotTime.setHours(Number(h), Number(m), 0, 0);
        const slotTimeEnd = new Date(slotTime.getTime() + 30 * 60000); // 30 mins slot duration

        // Matches if app starts inside slot, or spans across it
        const appEnd = new Date(item.endAt);
        return appStart < slotTimeEnd && appEnd > slotTime;
      }) ?? [];

    return apps;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Умное расписание</span>
          <h1>Расписание</h1>
          <p>Дневной и недельный календарь филиала, быстрый выбор слота и контроль конфликтов.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-button" type="button">
            <Filter size={17} />
            Фильтры
          </button>
          <button
            className="secondary-button"
            onClick={() => setSelectedDate(new Date())}
            type="button"
          >
            Сегодня
          </button>
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <button
              className="ghost-button"
              onClick={() => handleDateOffset(-1)}
              style={{
                padding: '8px 12px',
                minHeight: 'auto',
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
                borderRadius: 0,
              }}
              type="button"
              aria-label="Предыдущий день"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="ghost-button"
              onClick={() => handleDateOffset(1)}
              style={{
                padding: '8px 12px',
                minHeight: 'auto',
                background: 'var(--surface)',
                borderRadius: 0,
              }}
              type="button"
              aria-label="Следующий день"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            className="button"
            onClick={() =>
              document.getElementById('create-appointment')?.scrollIntoView({ behavior: 'smooth' })
            }
            type="button"
          >
            <CalendarPlus size={17} />
            Создать запись
          </button>
        </div>
      </div>

      <div
        className="schedule-shell"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        <section className="content-panel" style={{ overflow: 'hidden' }}>
          <div
            className="panel-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
            <div className="segmented" aria-label="Вид календаря">
              <button
                className={view === 'day' ? 'active' : ''}
                onClick={() => setView('day')}
                type="button"
              >
                День
              </button>
              <button
                className={view === 'week' ? 'active' : ''}
                onClick={() => setView('week')}
                type="button"
              >
                Неделя
              </button>
            </div>
          </div>

          {appointments.isLoading ? (
            <p className="muted" style={{ padding: '20px' }}>
              Загрузка расписания...
            </p>
          ) : null}

          {view === 'week' ? (
            <WeekView bootstrap={bootstrap} selectedDate={selectedDate} branchId={branchId} />
          ) : doctors.length ? (
            <div className="board-wrap">
              <div
                className="calendar-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `100px repeat(${doctors.length}, minmax(180px, 1fr))`,
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                {/* Headers */}
                <div
                  className="calendar-head"
                  style={{
                    background: 'var(--surface-soft)',
                    borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    padding: '12px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    color: 'var(--muted)',
                    textAlign: 'center',
                  }}
                >
                  Время
                </div>
                {doctors.map((doc) => (
                  <div
                    className="calendar-head"
                    key={doc.id}
                    style={{
                      background: 'var(--surface-soft)',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      padding: '12px',
                      textAlign: 'center',
                    }}
                  >
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>
                      {doc.name}
                    </strong>
                    <span className="muted" style={{ fontSize: '11px' }}>
                      {doc.role}
                    </span>
                  </div>
                ))}

                {/* Slots Rows */}
                {timeSlots.flatMap((hour) => {
                  const [hNum] = hour.split(':').map(Number);
                  const isOffHours = hNum < 9 || hNum >= 18; // color outside 9:00 - 18:00
                  return [
                    <div
                      className="time-cell"
                      key={`${hour}:time`}
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: isOffHours ? 'var(--muted)' : 'var(--ink)',
                        background: isOffHours ? 'var(--surface-soft)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {hour}
                    </div>,
                    ...doctors.map((doc) => {
                      const slotApps = getSlotAppointments(doc.id, hour);
                      const hasConflict = slotApps.length > 1;

                      return (
                        <div
                          className={`calendar-slot${isOffHours ? ' off-hours' : ''}`}
                          key={`${hour}:${doc.id}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            const id = event.dataTransfer.getData('appointment/id');
                            if (id) {
                              const [hStr, mStr] = hour.split(':');
                              const targetStart = new Date(selectedDate);
                              targetStart.setHours(Number(hStr), Number(mStr), 0, 0);
                              const targetEnd = new Date(targetStart.getTime() + 30 * 60 * 1000); // 30 min duration

                              reschedule.mutate(
                                {
                                  id,
                                  newStartAt: targetStart.toISOString(),
                                  newEndAt: targetEnd.toISOString(),
                                },
                                {
                                  onSuccess: () =>
                                    toast('success', 'Перенос успешен', 'Визит перенесен'),
                                  onError: (err: any) =>
                                    toast(
                                      'error',
                                      'Ошибка переноса',
                                      err.message || 'Не удалось перенести визит',
                                    ),
                                },
                              );
                            }
                          }}
                          style={{
                            padding: '6px',
                            borderBottom: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            background: isOffHours ? 'rgba(0,0,0,0.02)' : 'transparent',
                            minHeight: '64px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative',
                          }}
                        >
                          {slotApps.length > 0 ? (
                            slotApps.map((appointment) => (
                              <div
                                className="appointment-block"
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.setData('appointment/id', appointment.id);
                                }}
                                key={appointment.id}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: hasConflict
                                    ? '1px solid var(--danger)'
                                    : '1px solid var(--line)',
                                  background: hasConflict
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'var(--surface)',
                                  boxShadow: 'var(--shadow-sm)',
                                  fontSize: '11px',
                                  cursor: 'grab',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <strong
                                    style={{
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden',
                                      whiteSpace: 'nowrap',
                                      color: 'var(--ink)',
                                    }}
                                  >
                                    {appointment.patient?.fullName ?? 'Неизвестный пациент'}
                                  </strong>
                                  <span style={{ fontSize: '9px', fontWeight: 'bold' }}>
                                    {formatVisitTime(appointment.startAt)}
                                  </span>
                                </div>
                                <span className="muted" style={{ fontSize: '10px' }}>
                                  {appointment.service?.name ?? 'Без услуги'}
                                </span>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '4px',
                                    alignItems: 'center',
                                    marginTop: '2px',
                                  }}
                                >
                                  <span
                                    className={`status-badge status-${statusTone(appointment.status)}`}
                                    style={{
                                      fontSize: '8px',
                                      padding: '1px 4px',
                                      minHeight: '14px',
                                    }}
                                  >
                                    {statusLabel(appointment.status)}
                                  </span>
                                  {hasConflict && (
                                    <span
                                      style={{
                                        color: 'var(--danger)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                      }}
                                      title="Конфликт кабинета или врача"
                                    >
                                      <AlertTriangle size={10} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <button
                              onClick={() => handleSlotClick(doc.id, hour)}
                              className="ghost-button"
                              style={{
                                width: '100%',
                                height: '100%',
                                minHeight: '44px',
                                borderRadius: '4px',
                                border: '1px dashed var(--line)',
                                display: 'grid',
                                placeItems: 'center',
                                padding: 0,
                                fontSize: '11px',
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--line-strong)';
                                e.currentTarget.style.color = 'var(--muted)';
                                e.currentTarget.style.background = 'var(--surface-soft)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--line)';
                                e.currentTarget.style.color = 'var(--muted)';
                                e.currentTarget.style.background = 'transparent';
                              }}
                              type="button"
                            >
                              + Записать
                            </button>
                          )}
                        </div>
                      );
                    }),
                  ];
                })}
              </div>
            </div>
          ) : !appointments.isLoading ? (
            <div className="empty-state">
              <div>
                <strong>На сегодня врачи не найдены</strong>
                <span>Нет активных сотрудников в расписании.</span>
              </div>
            </div>
          ) : null}

          {/* Detailed All Appointments List */}
          {view === 'day' && appointments.data?.items && appointments.data.items.length > 0 && (
            <div className="section-gap" style={{ marginTop: '24px' }}>
              <div className="panel-header" style={{ marginBottom: '12px' }}>
                <div>
                  <h3>Все записи</h3>
                  <p className="muted">Быстрые действия доступны без открытия карточки.</p>
                </div>
              </div>
              <div
                className="list"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {appointments.data.items.map((appointment) => (
                  <div
                    className="row"
                    key={appointment.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong>
                        <Clock3
                          size={14}
                          style={{
                            inlineSize: '14px',
                            marginInlineEnd: '6px',
                            verticalAlign: 'middle',
                          }}
                        />
                        {formatVisitTime(appointment.startAt)} ·{' '}
                        {appointment.patient?.fullName ?? 'Неизвестный пациент'}
                      </strong>
                      <span className={`status-badge status-${statusTone(appointment.status)}`}>
                        {statusLabel(appointment.status)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span className="muted" style={{ fontSize: '12px' }}>
                        {appointment.service?.name ?? 'Без услуги'} ·{' '}
                        {appointment.appointmentNumber}
                      </span>
                      <div className="inline-actions" style={{ gap: '6px' }}>
                        {appointment.status === 'SCHEDULED' && (
                          <button
                            className="secondary-button"
                            onClick={() =>
                              transition.mutate(
                                { id: appointment.id, action: 'confirm' },
                                {
                                  onSuccess: () => toast('success', 'Подтверждено'),
                                  onError: () => toast('error', 'Ошибка'),
                                },
                              )
                            }
                            style={{ padding: '3px 8px', fontSize: '11px', minHeight: 'auto' }}
                            type="button"
                          >
                            Подтвердить
                          </button>
                        )}
                        {['SCHEDULED', 'CONFIRMED', 'WAITING'].includes(appointment.status) && (
                          <button
                            className="secondary-button"
                            onClick={() =>
                              transition.mutate(
                                { id: appointment.id, action: 'check-in' },
                                {
                                  onSuccess: () => toast('success', 'Прибыл'),
                                  onError: () => toast('error', 'Ошибка'),
                                },
                              )
                            }
                            style={{ padding: '3px 8px', fontSize: '11px', minHeight: 'auto' }}
                            type="button"
                          >
                            Отметить приход
                          </button>
                        )}
                        {appointment.status !== 'CANCELLED' &&
                          appointment.status !== 'COMPLETED' && (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                transition.mutate(
                                  { id: appointment.id, action: 'cancel' },
                                  {
                                    onSuccess: () => toast('success', 'Отменено'),
                                    onError: () => toast('error', 'Ошибка'),
                                  },
                                )
                              }
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                minHeight: 'auto',
                                color: 'var(--danger)',
                              }}
                              type="button"
                            >
                              Отменить
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right context panel: Room utilization & Appointment creation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <RoomUtilizationPanel branchId={branchId} selectedDate={selectedDate} />
          <CreateAppointmentForm
            bootstrap={bootstrap}
            prefilledDoctorId={prefilledDoctorId}
            prefilledTime={prefilledTime}
            onClearPrefills={() => {
              setPrefilledDoctorId('');
              setPrefilledTime('');
            }}
          />
        </div>
      </div>
    </>
  );
}
