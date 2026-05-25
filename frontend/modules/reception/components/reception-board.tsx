'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, LogIn, PhoneCall, Search, Play, CheckCircle2, XCircle, X, User } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { getRealtimeSocket } from '@/shared/realtime/socket';
import { formatVisitTime, statusLabel, statusTone } from '@/shared/ui/status';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useToast } from '@/shared/ui/toast';
import {
  useReceptionDashboard,
  useReceptionTransition,
  useReceptionCheckIn,
  usePatientPreview,
  DashboardCounters
} from '../hooks/use-reception-dashboard';

const columns = [
  { label: 'План', statuses: ['SCHEDULED', 'CONFIRMED'], dropStatus: 'CONFIRMED' },
  { label: 'Ожидают', statuses: ['CHECKED_IN'], dropStatus: 'CHECKED_IN' },
  { label: 'На приеме', statuses: ['IN_PROGRESS'], dropStatus: 'IN_PROGRESS' },
  { label: 'К оплате', statuses: ['COMPLETED_PENDING_PAYMENT'], dropStatus: 'COMPLETED_PENDING_PAYMENT' },
  { label: 'Завершено', statuses: ['COMPLETED'], dropStatus: 'COMPLETED' },
  { label: 'Отмены', statuses: ['CANCELLED', 'NO_SHOW'], dropStatus: 'CANCELLED' }
];

const COUNTER_META: Array<{ key: keyof DashboardCounters; label: string }> = [
  { key: 'total', label: 'Всего' },
  { key: 'waiting', label: 'Ожидают' },
  { key: 'checkedIn', label: 'Пришли' },
  { key: 'inProgress', label: 'На приеме' },
  { key: 'completed', label: 'Завершено' },
  { key: 'cancelled', label: 'Отмены' }
];

function QuickActions({ appointmentId, status, onAction }: {
  appointmentId: string;
  status: string;
  onAction: (id: string, status: string) => void;
}) {
  if (status === 'SCHEDULED' || status === 'CONFIRMED') {
    return (
      <button className="button" onClick={() => onAction(appointmentId, 'CHECK_IN')} type="button">
        <LogIn size={16} />
        Отметить приход
      </button>
    );
  }
  if (status === 'CHECKED_IN') {
    return (
      <button className="button" onClick={() => onAction(appointmentId, 'IN_PROGRESS')} type="button">
        <Play size={16} />
        Начать прием
      </button>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <button className="button" onClick={() => onAction(appointmentId, 'COMPLETED_PENDING_PAYMENT')} type="button">
        <CheckCircle2 size={16} />
        Завершить
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
      <aside className="slide-over">
        <div className="slide-over-header">
          <h2>Карточка пациента</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {isLoading ? (
          <SkeletonTable rows={4} />
        ) : patient ? (
          <>
            <div className="patient-identity">
              <div className="avatar">{patient.firstName?.[0]}{patient.lastName?.[0]}</div>
              <div>
                <strong>{patient.fullName}</strong>
                <span className="muted">{patient.patientCode}</span>
              </div>
            </div>
            <div className="list">
              <div className="row">
                <span className="eyebrow">Статус</span>
                <span className={`status-badge status-${statusTone(patient.status, 'patient')}`}>
                  {statusLabel(patient.status, 'patient')}
                </span>
              </div>
              {patient.birthDate ? (
                <div className="row">
                  <span className="eyebrow">Дата рождения</span>
                  <span>{new Date(patient.birthDate).toLocaleDateString('ru-RU')}</span>
                </div>
              ) : null}
              {patient.gender ? (
                <div className="row">
                  <span className="eyebrow">Пол</span>
                  <span>{patient.gender === 'MALE' ? 'Мужской' : patient.gender === 'FEMALE' ? 'Женский' : patient.gender}</span>
                </div>
              ) : null}
              {patient.contacts.length > 0 ? (
                <div className="row">
                  <span className="eyebrow">Контакты</span>
                  {patient.contacts.map(c => (
                    <span key={c.id}>{c.type}: {c.value}{c.isPrimary ? ' (основной)' : ''}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <a className="button" href={`/patients/${patient.id}`}>
              <User size={16} />
              Открыть полную карту
            </a>
          </>
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [previewPatientId, setPreviewPatientId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  const handleQuickAction = useCallback((appointmentId: string, action: string) => {
    if (action === 'CHECK_IN') {
      checkIn.mutate({ appointmentId }, {
        onSuccess: () => toast('success', 'Check-in', 'Пациент отмечен'),
        onError: () => toast('error', 'Ошибка', 'Не удалось выполнить check-in')
      });
    } else if (action === 'CANCEL') {
      setCancelTarget(appointmentId);
    } else {
      transition.mutate({ id: appointmentId, status: action }, {
        onSuccess: () => toast('success', 'Статус обновлен'),
        onError: () => toast('error', 'Ошибка', 'Не удалось обновить статус')
      });
    }
  }, [checkIn, transition, toast]);

  const handleConfirmCancel = useCallback(() => {
    if (!cancelTarget) return;
    transition.mutate({ id: cancelTarget, status: 'CANCELLED' }, {
      onSuccess: () => { toast('success', 'Визит отменен'); setCancelTarget(null); },
      onError: () => toast('error', 'Ошибка', 'Не удалось отменить визит')
    });
  }, [cancelTarget, transition, toast]);

  if (dashboard.isLoading) {
    return (
      <section className="content-panel">
        <SkeletonTable rows={6} />
      </section>
    );
  }

  if (dashboard.error || !dashboard.data) return <section className="content-panel error">Dashboard недоступен</section>;

  const { counters, queue } = dashboard.data;

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
                    className={`board-column${dragOverColumn === column.label ? ' drag-over' : ''}`}
                    key={column.label}
                    onDragOver={(event) => { event.preventDefault(); setDragOverColumn(column.label); }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(event) => {
                      setDragOverColumn(null);
                      const id = event.dataTransfer.getData('appointment/id');
                      if (id) {
                        transition.mutate({ id, status: column.dropStatus }, {
                          onSuccess: () => toast('success', 'Статус обновлен'),
                          onError: () => toast('error', 'Ошибка', 'Не удалось обновить статус')
                        });
                      }
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
                          <strong>
                            <button
                              className="ghost-button"
                              style={{ padding: 0, minHeight: 'auto', fontWeight: 700, color: 'var(--ink)' }}
                              onClick={() => setPreviewPatientId(appointment.patientId)}
                              type="button"
                            >
                              {appointment.patient.fullName}
                            </button>
                          </strong>
                          <span>{formatVisitTime(appointment.startAt)}</span>
                        </div>
                        <span>{appointment.service?.name ?? 'Визит'} · {appointment.appointmentNumber}</span>
                        <span className={`status-badge status-${statusTone(appointment.status)}`}>{statusLabel(appointment.status)}</span>
                        <div className="inline-actions">
                          <QuickActions
                            appointmentId={appointment.id}
                            status={appointment.status}
                            onAction={handleQuickAction}
                          />
                          {appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED' && appointment.status !== 'NO_SHOW' ? (
                            <button
                              className="ghost-button"
                              style={{ color: 'var(--danger)', padding: '4px 8px', minHeight: 'auto', fontSize: '12px' }}
                              onClick={() => handleQuickAction(appointment.id, 'CANCEL')}
                              type="button"
                            >
                              <XCircle size={14} />
                              Отмена
                            </button>
                          ) : null}
                        </div>
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
          {queue.length ? queue.map((item, index) => (
            <div className="queue-row" key={item.id}>
              <strong className="queue-index">{index + 1}</strong>
              <button
                className="ghost-button"
                style={{ padding: 0, minHeight: 'auto', justifyContent: 'flex-start', fontWeight: 600 }}
                onClick={() => setPreviewPatientId(item.patientId)}
                type="button"
              >
                {item.patient.fullName}
              </button>
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

      {/* Patient preview slide-over */}
      {previewPatientId ? (
        <PatientSlideOver
          patientId={previewPatientId}
          onClose={() => setPreviewPatientId(null)}
        />
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
