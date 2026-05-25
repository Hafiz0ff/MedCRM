'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus, MessageSquare, Phone, StickyNote } from 'lucide-react';
import { statusLabel, statusTone } from '@/shared/ui/status';
import { usePatient, useUpdatePatient, usePatientTimeline } from '../hooks/use-patients';

export function PatientDetails({ id }: { id: string }) {
  const patient = usePatient(id);
  const updatePatient = useUpdatePatient(id);
  const timeline = usePatientTimeline(id);
  const [status, setStatus] = useState('ACTIVE');

  useEffect(() => {
    if (patient.data?.status) setStatus(patient.data.status);
  }, [patient.data?.status]);

  if (patient.isLoading) return <section className="content-panel">Загрузка...</section>;
  if (patient.error || !patient.data) return <section className="content-panel error">Пациент не найден</section>;

  return (
    <>
      <section className="patient-hero">
        <div className="patient-identity">
          <span className="avatar">{patient.data.firstName[0]}{patient.data.lastName[0]}</span>
          <div>
            <span className="eyebrow">Карточка пациента</span>
            <h1>{patient.data.fullName}</h1>
            <div className="badges">
              <span className="badge">{patient.data.patientCode}</span>
              <span className={`status-badge status-${statusTone(patient.data.status, 'patient')}`}>
                {statusLabel(patient.data.status, 'patient')}
              </span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <a className="secondary-button" href="/schedule">
            <CalendarPlus size={17} />
            Записать
          </a>
          <button className="secondary-button" type="button">
            <Phone size={17} />
            Позвонить
          </button>
          <button className="secondary-button" type="button">
            <MessageSquare size={17} />
            Сообщение
          </button>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Профиль CRM</h2>
              <p className="muted">Контакты, статус и быстрые операционные действия.</p>
            </div>
          </div>
          <div className="patient-tabs">
            <div className="row">
              <strong>Контакты</strong>
              {patient.data.contacts.length ? patient.data.contacts.map((contact) => (
                <span className="muted" key={contact.id}>{contact.type}: {contact.value}</span>
              )) : <span className="muted">Контакты не указаны</span>}
            </div>
            <div className="row">
              <strong>Дата рождения</strong>
              <span className="muted">{patient.data.birthDate ?? 'Не указана'}</span>
            </div>
            <div className="row">
              <strong>Пол</strong>
              <span className="muted">{patient.data.gender ?? 'Не указан'}</span>
            </div>
            <div className="row">
              <strong>Филиал регистрации</strong>
              <span className="muted">{patient.data.registrationBranchId ?? 'Не указан'}</span>
            </div>
          </div>
        </section>

        <aside className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Статус пациента</h2>
              <p className="muted">Изменение статуса попадет в audit trail backend.</p>
            </div>
            <StickyNote size={20} />
          </div>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              updatePatient.mutate({ status });
            }}
          >
            <div className="field">
              <label htmlFor="patientStatus">CRM статус</label>
              <select id="patientStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="NEW">Новый</option>
                <option value="ACTIVE">Активный</option>
                <option value="SLEEPING">Спящий</option>
                <option value="VIP">VIP</option>
                <option value="BLOCKED">Ограничен</option>
              </select>
            </div>
            <button className="button" disabled={updatePatient.isPending}>
              {updatePatient.isPending ? 'Обновление...' : 'Обновить статус'}
            </button>
          </form>
        </aside>
      </div>

      <section className="content-panel section-gap">
        <div className="panel-header">
          <div>
            <h2>Timeline</h2>
            <p className="muted">Хронологическая история визитов, звонков, документов и заметок.</p>
          </div>
        </div>
        {timeline.isLoading ? (
          <p className="muted">Загрузка таймлайна...</p>
        ) : timeline.data?.length ? (
          <div className="timeline">
            {timeline.data.map((event) => (
              <div className="timeline-item" key={event.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{event.title}</strong>
                  {event.body ? <p className="muted">{event.body}</p> : null}
                  <span className="muted" style={{ display: 'block', fontSize: '0.8rem', marginTop: '4px' }}>
                    {new Date(event.eventDate).toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>Нет событий в истории</strong>
              <span>Вся история активности пациента отобразится здесь.</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
