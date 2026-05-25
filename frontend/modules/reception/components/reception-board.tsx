'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  LogIn,
  PhoneCall,
  Search,
  Play,
  CheckCircle2,
  XCircle,
  X,
  User,
  AlertTriangle,
  Award,
  CircleDollarSign,
  Users,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import {
  useReceptionDashboard,
  useReceptionTransition,
  useReceptionCheckIn,
  usePatientPreview,
  useUpdateQueuePriority,
  DashboardCounters,
} from '../hooks/use-reception-dashboard';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { useToast } from '@/shared/ui/toast';

// We map 'План' status to 'WAITING' as returned by the backend cache.
const columns = [
  { label: 'Ожидает', statuses: ['WAITING', 'CHECKED_IN'], dropStatus: 'CHECKED_IN' },
  { label: 'В кабинете', statuses: ['IN_PROGRESS'], dropStatus: 'IN_PROGRESS' },
  {
    label: 'Оформление',
    statuses: ['COMPLETED_PENDING_PAYMENT'],
    dropStatus: 'COMPLETED_PENDING_PAYMENT',
  },
  { label: 'Завершено', statuses: ['COMPLETED'], dropStatus: 'COMPLETED' },
];

const COUNTER_META: Array<{ key: keyof DashboardCounters; label: string }> = [
  { key: 'total', label: 'Все визиты' },
  { key: 'waiting', label: 'План' },
  { key: 'checkedIn', label: 'Очередь' },
  { key: 'inProgress', label: 'В кабинете' },
  { key: 'completedPendingPayment', label: 'Оформление' },
  { key: 'completed', label: 'Завершено' },
];

function QuickActions({
  appointmentId,
  status,
  onAction,
}: {
  appointmentId: string;
  status: string;
  onAction: (id: string, status: string) => void;
}) {
  if (status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'WAITING') {
    return (
      <button
        className="button"
        onClick={() => onAction(appointmentId, 'CHECK_IN')}
        type="button"
        style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', gap: '4px' }}
      >
        <LogIn size={12} />
        Приход
      </button>
    );
  }
  if (status === 'CHECKED_IN') {
    return (
      <button
        className="button"
        onClick={() => onAction(appointmentId, 'IN_PROGRESS')}
        type="button"
        style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', gap: '4px' }}
      >
        <Play size={12} />
        Начать
      </button>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <button
        className="button"
        onClick={() => onAction(appointmentId, 'COMPLETED_PENDING_PAYMENT')}
        type="button"
        style={{ padding: '4px 8px', fontSize: '11px', minHeight: 'auto', gap: '4px' }}
      >
        <CheckCircle2 size={12} />
        Завершить
      </button>
    );
  }
  if (status === 'COMPLETED_PENDING_PAYMENT') {
    return (
      <button
        className="button"
        onClick={() => onAction(appointmentId, 'COMPLETED')}
        type="button"
        style={{
          padding: '4px 8px',
          fontSize: '11px',
          minHeight: 'auto',
          gap: '4px',
          background: '#f97316',
        }}
      >
        <CircleDollarSign size={12} />
        Оплата
      </button>
    );
  }
  return null;
}

function PatientSlideOver({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data: patient, isLoading } = usePatientPreview(patientId);

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <aside className="slide-over" style={{ width: '420px', maxWidth: '100%' }}>
        <div
          className="slide-over-header"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <h2>Карточка пациента</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {isLoading ? (
          <div style={{ padding: '20px' }}>
            <SkeletonTable rows={5} />
          </div>
        ) : patient ? (
          <div
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              overflowY: 'auto',
              height: 'calc(100% - 70px)',
            }}
          >
            <div
              className="patient-identity"
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <div
                className="avatar"
                style={{
                  width: '48px',
                  height: '48px',
                  fontSize: '16px',
                  background: 'var(--brand-soft)',
                  color: 'var(--brand)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  fontWeight: 'bold',
                }}
              >
                {patient.fullName?.[0] || 'П'}
              </div>
              <div>
                <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>
                  {patient.fullName}
                </strong>
                <span className="muted" style={{ display: 'block', fontSize: '12px' }}>
                  {patient.patientCode}
                </span>
              </div>
            </div>

            {/* Quick Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`status-badge status-${statusTone(patient.status, 'patient')}`}>
                {statusLabel(patient.status, 'patient')}
              </span>
              {patient.isVip && (
                <span className="status-badge status-violet" style={{ gap: '4px' }}>
                  <Award size={12} /> VIP
                </span>
              )}
              {patient.debt > 0 && (
                <span className="status-badge status-danger" style={{ gap: '4px' }}>
                  Долг {patient.debt} ₽
                </span>
              )}
            </div>

            {/* Custom tags */}
            {patient.tags?.length > 0 && (
              <div>
                <span
                  className="eyebrow"
                  style={{ fontSize: '10px', display: 'block', marginBottom: '6px' }}
                >
                  Теги CRM
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {patient.tags.map((t: any) => (
                    <span
                      key={t.id}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: t.color || '#e2e8f0',
                        color: '#1e293b',
                        fontWeight: 600,
                      }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* General Info */}
            <div
              className="list"
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--surface-soft)',
                padding: '12px',
              }}
            >
              <div
                className="row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontSize: '13px',
                }}
              >
                <span className="muted">Возраст</span>
                <strong>{patient.age ? `${patient.age} лет` : 'Не указан'}</strong>
              </div>
              <div
                className="row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontSize: '13px',
                }}
              >
                <span className="muted">Пол</span>
                <strong>
                  {patient.gender === 'MALE'
                    ? 'Мужской'
                    : patient.gender === 'FEMALE'
                      ? 'Женский'
                      : 'Не указан'}
                </strong>
              </div>
              <div
                className="row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  fontSize: '13px',
                }}
              >
                <span className="muted">Телефон</span>
                <strong>{patient.phone || 'Нет'}</strong>
              </div>
            </div>

            {/* Metrics */}
            {patient.metrics && (
              <div>
                <span
                  className="eyebrow"
                  style={{ fontSize: '10px', display: 'block', marginBottom: '6px' }}
                >
                  Показатели
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px',
                      background: 'var(--surface)',
                    }}
                  >
                    <span className="muted" style={{ fontSize: '10px', display: 'block' }}>
                      Всего визитов
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                      {patient.metrics.totalVisits}
                    </strong>
                  </div>
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px',
                      background: 'var(--surface)',
                    }}
                  >
                    <span className="muted" style={{ fontSize: '10px', display: 'block' }}>
                      Выручка (LTV)
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                      {patient.metrics.ltv} ₽
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Family Members */}
            {patient.familyMembers?.length > 0 && (
              <div>
                <span
                  className="eyebrow"
                  style={{ fontSize: '10px', display: 'block', marginBottom: '6px' }}
                >
                  Семья
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {patient.familyMembers.map((fm: any) => (
                    <div
                      key={fm.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        padding: '6px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                      }}
                    >
                      <strong>{fm.name}</strong>
                      <span className="muted">{fm.relation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Appointments */}
            {patient.recentAppointments?.length > 0 && (
              <div>
                <span
                  className="eyebrow"
                  style={{ fontSize: '10px', display: 'block', marginBottom: '6px' }}
                >
                  Ближайшая история
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {patient.recentAppointments.map((app: any) => (
                    <div
                      key={app.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                      }}
                    >
                      <div>
                        <strong style={{ display: 'block' }}>{app.service}</strong>
                        <span className="muted">
                          {new Date(app.date).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <span
                        className={`status-badge status-${statusTone(app.status)}`}
                        style={{ scale: '0.9', padding: '2px 6px' }}
                      >
                        {statusLabel(app.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a
              className="button"
              href={`/patients/${patient.id}`}
              style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
            >
              <User size={16} />
              Открыть полную карту
            </a>
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>Пациент не найден</strong>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export function ReceptionBoard({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id;
  const dashboard = useReceptionDashboard(branchId);
  const transition = useReceptionTransition();
  const checkIn = useReceptionCheckIn();
  const updatePriority = useUpdateQueuePriority();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [previewPatientId, setPreviewPatientId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
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

  const handleQuickAction = useCallback(
    (appointmentId: string, action: string) => {
      if (action === 'CHECK_IN') {
        checkIn.mutate(
          { appointmentId },
          {
            onSuccess: () => toast('success', 'Check-in', 'Пациент отмечен'),
            onError: () => toast('error', 'Ошибка', 'Не удалось выполнить check-in'),
          },
        );
      } else if (action === 'CANCEL') {
        setCancelTarget(appointmentId);
      } else {
        transition.mutate(
          { id: appointmentId, status: action },
          {
            onSuccess: () => toast('success', 'Статус обновлен'),
            onError: () => toast('error', 'Ошибка', 'Не удалось обновить статус'),
          },
        );
      }
    },
    [checkIn, transition, toast],
  );

  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;
    transition.mutate(
      { id: cancelTarget, status: 'CANCELLED' },
      {
        onSuccess: () => {
          toast('success', 'Визит отменен');
          setCancelTarget(null);
        },
        onError: () => toast('error', 'Ошибка', 'Не удалось отменить визит'),
      },
    );
  }, [cancelTarget, transition, toast]);

  if (dashboard.isLoading) {
    return (
      <section className="content-panel">
        <SkeletonTable rows={6} />
      </section>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return <section className="content-panel error">Dashboard недоступен</section>;
  }

  const { counters, queue } = dashboard.data;

  // Function to detect if appointment is late
  const isLateAppointment = (startAtStr: string, status: string) => {
    if (!['SCHEDULED', 'CONFIRMED', 'WAITING'].includes(status)) return false;
    const startTime = new Date(startAtStr);
    return startTime.getTime() < Date.now() - 10 * 60 * 1000; // 10 minutes grace
  };

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Живая очередь</span>
          <h1>Регистратура</h1>
          <p>Поток пациентов по этапам смены, быстрые действия и приоритеты электронной очереди.</p>
        </div>
        <div className="page-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const modal = document.querySelector('.global-search input') as HTMLInputElement;
              if (modal) modal.focus();
            }}
          >
            <Search size={17} />
            Найти пациента
          </button>
          <a className="button" href="/schedule">
            <Clock3 size={17} />
            Быстрая запись
          </a>
        </div>
      </div>

      {/* Counter cards */}
      {counters ? (
        <div className="counter-cards">
          {COUNTER_META.map(({ key, label }) => (
            <div className="counter-card" key={key}>
              <span className="counter-value">{counters[key] ?? 0}</span>
              <span className="counter-label">{label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="reception-layout">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Доска приёма</h2>
              <p className="muted">
                Обновлено{' '}
                {new Date(dashboard.data.recalculatedAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                ; перетащите карточку или используйте быстрые действия.
              </p>
            </div>
            <span className="realtime-pill">
              <span className="dot" /> Live
            </span>
          </div>
          <div className="board-wrap">
            <div className="board live-queue-board">
              {columns.map((column) => {
                const appointments = column.statuses.flatMap(
                  (status) => dashboard.data.columns[status] ?? [],
                );
                return (
                  <div
                    className={`board-column${dragOverColumn === column.label ? ' drag-over' : ''}`}
                    key={column.label}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverColumn(column.label);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(event) => {
                      setDragOverColumn(null);
                      const id = event.dataTransfer.getData('appointment/id');
                      if (id) {
                        transition.mutate(
                          { id, status: column.dropStatus },
                          {
                            onSuccess: () => toast('success', 'Статус обновлен'),
                            onError: () => toast('error', 'Ошибка', 'Не удалось обновить статус'),
                          },
                        );
                      }
                    }}
                    style={{
                      minHeight: '550px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                      <span>{column.label}</span>
                      <span className="badge">{appointments.length}</span>
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: 1,
                        overflowY: 'auto',
                      }}
                    >
                      {appointments.map((appointment) => {
                        const late = isLateAppointment(appointment.startAt, appointment.status);
                        return (
                          <article
                            className="visit-card"
                            key={appointment.id}
                            draggable
                            onDragStart={(event) =>
                              event.dataTransfer.setData('appointment/id', appointment.id)
                            }
                            style={{
                              padding: '10px',
                              gap: '6px',
                              borderLeft: late
                                ? '4px solid var(--danger)'
                                : appointment.isVip
                                  ? '4px solid var(--violet)'
                                  : '1px solid var(--line)',
                            }}
                          >
                            <div className="visit-card-header">
                              <strong style={{ fontSize: '13px' }}>
                                <button
                                  className="ghost-button"
                                  style={{
                                    padding: 0,
                                    minHeight: 'auto',
                                    fontWeight: 700,
                                    color: appointment.isVip ? 'var(--violet)' : 'var(--ink)',
                                    textAlign: 'left',
                                  }}
                                  onClick={() => setPreviewPatientId(appointment.patientId)}
                                  type="button"
                                >
                                  {appointment.patientName || appointment.patient?.fullName}
                                </button>
                              </strong>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: late ? 'var(--danger)' : 'var(--muted)',
                                }}
                              >
                                {formatVisitTime(appointment.startAt)}
                              </span>
                            </div>

                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--muted)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              }}
                            >
                              <span>
                                {appointment.service?.name ?? 'Визит'} ·{' '}
                                {appointment.appointmentNumber}
                              </span>
                              {appointment.doctorName && (
                                <span>Врач: {appointment.doctorName}</span>
                              )}
                              {appointment.roomName && <span>Кабинет: {appointment.roomName}</span>}
                            </div>

                            {/* Flags inside card */}
                            <div
                              style={{
                                display: 'flex',
                                gap: '4px',
                                flexWrap: 'wrap',
                                marginTop: '2px',
                              }}
                            >
                              <span
                                className={`status-badge status-${statusTone(appointment.status)}`}
                                style={{ fontSize: '10px', padding: '1px 5px', minHeight: '18px' }}
                              >
                                {statusLabel(appointment.status)}
                              </span>
                              {appointment.isVip && (
                                <span
                                  className="status-badge status-violet"
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    minHeight: '18px',
                                  }}
                                >
                                  VIP
                                </span>
                              )}
                              {(appointment.debt ?? 0) > 0 && (
                                <span
                                  className="status-badge status-danger"
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    minHeight: '18px',
                                  }}
                                >
                                  Долг {appointment.debt} ₽
                                </span>
                              )}
                            </div>

                            <div
                              className="inline-actions"
                              style={{ marginTop: '4px', gap: '4px' }}
                            >
                              <QuickActions
                                appointmentId={appointment.id}
                                status={appointment.status}
                                onAction={handleQuickAction}
                              />
                              {appointment.status !== 'CANCELLED' &&
                              appointment.status !== 'COMPLETED' &&
                              appointment.status !== 'NO_SHOW' ? (
                                <button
                                  className="ghost-button"
                                  style={{
                                    color: 'var(--danger)',
                                    padding: '4px 6px',
                                    minHeight: 'auto',
                                    fontSize: '11px',
                                  }}
                                  onClick={() => handleQuickAction(appointment.id, 'CANCEL')}
                                  type="button"
                                >
                                  Отмена
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                      {!appointments.length ? (
                        <div className="empty-state" style={{ padding: '20px 10px', opacity: 0.7 }}>
                          <div>
                            <strong>Пусто</strong>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right context rail: Electronic Queue */}
        <aside className="content-panel queue-panel" style={{ width: '320px', flexShrink: 0 }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <div>
              <h2>Очередь</h2>
              <p className="muted">Пациенты в клинике, ожидающие приема.</p>
            </div>
            <PhoneCall size={20} className="muted" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue && queue.length ? (
              queue.map((item: any, index) => {
                const estWait = index * 15; // 15 mins estimated wait time per position
                return (
                  <div
                    className="queue-row"
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: item.isVip ? 'rgba(109, 40, 217, 0.03)' : 'var(--surface)',
                      borderLeft: item.isVip
                        ? '4px solid var(--violet)'
                        : '1px solid var(--border)',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}
                      >
                        <span
                          style={{
                            background: item.isVip ? 'var(--violet-soft)' : 'var(--surface-soft)',
                            color: item.isVip ? 'var(--violet)' : 'var(--muted)',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          {index + 1}
                        </span>
                        <button
                          className="ghost-button"
                          style={{
                            padding: 0,
                            minHeight: 'auto',
                            justifyContent: 'flex-start',
                            fontWeight: 650,
                            fontSize: '13px',
                            color: item.isVip ? 'var(--violet)' : 'var(--ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => setPreviewPatientId(item.patientId)}
                          type="button"
                        >
                          {item.patientName || item.patient?.fullName}
                        </button>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 750,
                          color:
                            estWait > 30
                              ? 'var(--danger)'
                              : estWait > 15
                                ? '#d97706'
                                : 'var(--success)',
                        }}
                      >
                        {estWait === 0 ? 'След.' : `~${estWait} мин`}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <span className="muted" style={{ fontSize: '11px' }}>
                        Кабинет: {item.roomName || 'Не назначен'}
                      </span>
                      <select
                        value={item.priority || 'NORMAL'}
                        onChange={(e) => {
                          updatePriority.mutate(
                            { id: item.id, priority: e.target.value },
                            {
                              onSuccess: () =>
                                toast(
                                  'success',
                                  'Приоритет изменен',
                                  'Очередь автоматически пересчитана',
                                ),
                              onError: () =>
                                toast('error', 'Ошибка', 'Не удалось обновить приоритет'),
                            },
                          );
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '10px',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          background: 'var(--surface-soft)',
                          color: 'var(--ink)',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        <option value="VIP">★ VIP</option>
                        <option value="URGENT">⚡ Срочно</option>
                        <option value="NORMAL">Обычный</option>
                        <option value="LOW">Низкий</option>
                      </select>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div>
                  <strong>Очередь пуста</strong>
                  <span style={{ fontSize: '11px' }}>
                    Новые check-in появятся здесь автоматически.
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Patient preview slide-over */}
      {previewPatientId ? (
        <PatientSlideOver patientId={previewPatientId} onClose={() => setPreviewPatientId(null)} />
      ) : null}

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Отменить визит?"
        message="Визит будет отмечен как отменённый. Это действие нельзя будет отменить."
        confirmLabel="Отменить визит"
        cancelLabel="Назад"
        variant="danger"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  );
}
