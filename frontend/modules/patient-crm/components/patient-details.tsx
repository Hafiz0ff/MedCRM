'use client';

import {
  CalendarPlus,
  MessageSquare,
  Phone,
  StickyNote,
  Plus,
  Trash2,
  Star,
  Users,
  Award,
  TrendingUp,
  Coins,
  Activity,
  X,
  User,
  Heart,
  History,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  usePatient,
  useUpdatePatient,
  usePatientTimeline,
  useAddPatientContact,
  useDeletePatientContact,
  useAddPatientNote,
  useListTags,
  useAssignPatientTag,
  useRemovePatientTag,
} from '../hooks/use-patients';
import { EmrPanel } from '@/modules/emr/components/emr-panel';
import { statusLabel, statusTone } from '@/shared/ui/status';
import { useToast } from '@/shared/ui/toast';

export function PatientDetails({ id }: { id: string }) {
  const patient = usePatient(id);
  const updatePatient = useUpdatePatient(id);
  const timeline = usePatientTimeline(id);

  const addContact = useAddPatientContact(id);
  const deleteContact = useDeletePatientContact(id);
  const addNote = useAddPatientNote(id);
  const allTags = useListTags();
  const assignTag = useAssignPatientTag(id);
  const removeTag = useRemovePatientTag(id);

  const { toast } = useToast();

  const [status, setStatus] = useState('ACTIVE');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactType, setNewContactType] = useState('PHONE');
  const [newContactValue, setNewContactValue] = useState('');
  const [newContactPrimary, setNewContactPrimary] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Tabbed layout state
  const [activeTab, setActiveTab] = useState<'crm' | 'emr' | 'timeline'>('crm');

  const patientData = patient.data as any;

  useEffect(() => {
    if (patientData?.status) setStatus(patientData.status);
  }, [patientData?.status]);

  if (patient.isLoading) return <section className="content-panel">Загрузка...</section>;
  if (patient.error || !patientData)
    return <section className="content-panel error">Пациент не найден</section>;

  return (
    <>
      <section className="patient-hero">
        <div className="patient-identity">
          <span className="avatar">
            {patientData.firstName[0]}
            {patientData.lastName[0]}
          </span>
          <div>
            <span className="eyebrow">Карточка пациента</span>
            <h1>{patientData.fullName}</h1>
            <div className="badges">
              <span className="badge">{patientData.patientCode}</span>
              <span className={`status-badge status-${statusTone(patientData.status, 'patient')}`}>
                {statusLabel(patientData.status, 'patient')}
              </span>
            </div>
          </div>
        </div>
        <div className="page-actions">
          <a className="secondary-button" href="/schedule">
            <CalendarPlus size={17} />
            Записать
          </a>
          <button
            className="secondary-button"
            type="button"
            onClick={() => toast('info', 'Звонок', 'Интеграция с IP-телефонией подключается')}
          >
            <Phone size={17} />
            Позвонить
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => toast('info', 'SMS-рассылка', 'Модуль рассылок подключается')}
          >
            <MessageSquare size={17} />
            Сообщение
          </button>
        </div>
      </section>

      {/* Metrics section */}
      <div
        className="crm-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          className="stats-card"
          style={{
            padding: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span
            className="stats-label"
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Coins size={14} /> LTV
          </span>
          <strong className="stats-value" style={{ fontSize: '1.25rem' }}>
            {Number(patientData.metrics?.ltv ?? 0).toLocaleString('ru-RU')} ₽
          </strong>
        </div>
        <div
          className="stats-card"
          style={{
            padding: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span
            className="stats-label"
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <TrendingUp size={14} /> Средний чек
          </span>
          <strong className="stats-value" style={{ fontSize: '1.25rem' }}>
            {Number(patientData.metrics?.averageCheck ?? 0).toLocaleString('ru-RU')} ₽
          </strong>
        </div>
        <div
          className="stats-card"
          style={{
            padding: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span
            className="stats-label"
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} /> Визиты
          </span>
          <strong className="stats-value" style={{ fontSize: '1.25rem' }}>
            {patientData.metrics?.totalVisits ?? 0}
          </strong>
        </div>
        <div
          className="stats-card"
          style={{
            padding: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span
            className="stats-label"
            style={{
              fontSize: '12px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Award size={14} /> Retention
          </span>
          <strong className="stats-value" style={{ fontSize: '1.25rem' }}>
            {patientData.metrics?.retentionScore ?? 100}%
          </strong>
        </div>
      </div>

      {/* Tab Switcher Headers */}
      <nav
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
          marginBottom: '24px',
        }}
        aria-label="Разделы карточки пациента"
      >
        <button
          onClick={() => setActiveTab('crm')}
          className={`secondary-button ${activeTab === 'crm' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '36px',
            padding: '6px 16px',
            borderBottom: activeTab === 'crm' ? '2px solid var(--brand)' : 'none',
            borderRadius: activeTab === 'crm' ? '6px 6px 0 0' : '6px',
          }}
          type="button"
        >
          <User size={16} />
          CRM Профиль
        </button>
        <button
          onClick={() => setActiveTab('emr')}
          className={`secondary-button ${activeTab === 'emr' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '36px',
            padding: '6px 16px',
            borderBottom: activeTab === 'emr' ? '2px solid var(--brand)' : 'none',
            borderRadius: activeTab === 'emr' ? '6px 6px 0 0' : '6px',
          }}
          type="button"
        >
          <Heart size={16} />
          Электронная Медкарта (EMR)
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`secondary-button ${activeTab === 'timeline' ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '36px',
            padding: '6px 16px',
            borderBottom: activeTab === 'timeline' ? '2px solid var(--brand)' : 'none',
            borderRadius: activeTab === 'timeline' ? '6px 6px 0 0' : '6px',
          }}
          type="button"
        >
          <History size={16} />
          История активности (Timeline)
        </button>
      </nav>

      <div
        className="workspace-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* TAB 1: CRM Profile */}
          {activeTab === 'crm' && (
            <>
              <section className="content-panel">
                <div className="panel-header">
                  <div>
                    <h2>Профиль CRM</h2>
                    <p className="muted">Контакты, статус и быстрые операционные действия.</p>
                  </div>
                </div>
                <div className="patient-tabs">
                  {/* Contacts CRUD */}
                  <div
                    className="section-gap"
                    style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <strong>Контакты</strong>
                      <button
                        className="secondary-button"
                        style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                        onClick={() => setShowAddContact(!showAddContact)}
                        type="button"
                      >
                        <Plus size={14} /> Добавить
                      </button>
                    </div>

                    {showAddContact && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newContactValue) return;
                          addContact.mutate(
                            {
                              type: newContactType,
                              value: newContactValue,
                              isPrimary: newContactPrimary,
                            },
                            {
                              onSuccess: () => {
                                setNewContactValue('');
                                setShowAddContact(false);
                                toast('success', 'Контакт добавлен');
                              },
                              onError: () => toast('error', 'Не удалось добавить контакт'),
                            },
                          );
                        }}
                        style={{
                          display: 'flex',
                          gap: '8px',
                          marginBottom: '16px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          padding: '12px',
                          border: '1px dashed var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                        }}
                      >
                        <select
                          value={newContactType}
                          onChange={(e) => setNewContactType(e.target.value)}
                          style={{
                            padding: '4px',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                          }}
                        >
                          <option value="PHONE">Телефон</option>
                          <option value="EMAIL">Email</option>
                          <option value="TELEGRAM">Telegram</option>
                        </select>
                        <input
                          placeholder="Значение"
                          value={newContactValue}
                          onChange={(e) => setNewContactValue(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                            flex: 1,
                          }}
                        />
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: 'var(--ink)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newContactPrimary}
                            onChange={(e) => setNewContactPrimary(e.target.checked)}
                          />
                          Основной
                        </label>
                        <button
                          className="button"
                          style={{ padding: '4px 12px', minHeight: 'auto', fontSize: '12px' }}
                        >
                          Сохранить
                        </button>
                      </form>
                    )}

                    <div
                      className="list"
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      {patientData.contacts.length ? (
                        patientData.contacts.map((contact: any) => (
                          <div
                            className="row"
                            key={contact.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '4px 0',
                            }}
                          >
                            <span className="muted">
                              {contact.type}: {contact.value}{' '}
                              {contact.isPrimary ? (
                                <span className="today-badge" style={{ marginLeft: '6px' }}>
                                  Основной
                                </span>
                              ) : null}
                            </span>
                            <button
                              className="ghost-button"
                              style={{ color: 'var(--danger)', padding: 0, minHeight: 'auto' }}
                              onClick={() => {
                                if (confirm('Удалить этот контакт?')) {
                                  deleteContact.mutate(contact.id, {
                                    onSuccess: () => toast('success', 'Контакт удален'),
                                    onError: () => toast('error', 'Ошибка удаления'),
                                  });
                                }
                              }}
                              type="button"
                              aria-label="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="muted">Контакты не указаны</span>
                      )}
                    </div>
                  </div>

                  {/* General Metadata */}
                  <div
                    className="row"
                    style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}
                  >
                    <strong>Дата рождения</strong>
                    <span className="muted">
                      {patientData.birthDate
                        ? new Date(patientData.birthDate).toLocaleDateString('ru-RU')
                        : 'Не указана'}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}
                  >
                    <strong>Пол</strong>
                    <span className="muted">
                      {patientData.gender === 'MALE'
                        ? 'Мужской'
                        : patientData.gender === 'FEMALE'
                          ? 'Женский'
                          : 'Не указан'}
                    </span>
                  </div>
                  <div className="row" style={{ padding: '12px 0' }}>
                    <strong>Филиал регистрации</strong>
                    <span className="muted">{patientData.registrationBranchId ?? 'Не указан'}</span>
                  </div>
                </div>
              </section>

              {/* Family Ties section */}
              <section className="content-panel">
                <div
                  className="panel-header"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Users size={18} />
                  <h2>Семейная группа</h2>
                </div>
                <div
                  className="list"
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {patientData.familyMembers?.length ? (
                    patientData.familyMembers.flatMap((fm: any) =>
                      fm.familyGroup.members
                        .filter((m: any) => m.patientId !== id)
                        .map((m: any) => (
                          <div
                            className="row"
                            key={m.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 0',
                            }}
                          >
                            <strong>{m.patient.fullName}</strong>
                            <span
                              className="status-badge status-normal"
                              style={{ fontSize: '11px' }}
                            >
                              {fm.relationType === 'PARENT'
                                ? 'Родитель'
                                : fm.relationType === 'CHILD'
                                  ? 'Ребенок'
                                  : fm.relationType === 'SPOUSE'
                                    ? 'Супруг(а)'
                                    : fm.relationType}
                            </span>
                          </div>
                        )),
                    )
                  ) : (
                    <div className="empty-state" style={{ padding: '16px 0' }}>
                      <span className="muted">Пациент не состоит в семейных группах</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* TAB 2: EMR Dashboard */}
          {activeTab === 'emr' && <EmrPanel patientId={id} />}

          {/* TAB 3: Activity Timeline Feed */}
          {activeTab === 'timeline' && (
            <section className="content-panel">
              <div className="panel-header">
                <div>
                  <h2>Timeline</h2>
                  <p className="muted">
                    Хронологическая история визитов, звонков, документов и заметок.
                  </p>
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
                        <span
                          className="muted"
                          style={{ display: 'block', fontSize: '0.8rem', marginTop: '4px' }}
                        >
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
          )}
        </div>

        {/* Right Sticky sidebar stays static across tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status section */}
          <aside className="content-panel">
            <div className="panel-header">
              <div>
                <h2>Статус пациента</h2>
                <p className="muted">Изменение статуса попадет в audit trail.</p>
              </div>
              <StickyNote size={20} />
            </div>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                updatePatient.mutate(
                  { status },
                  {
                    onSuccess: () => toast('success', 'Статус обновлен'),
                    onError: () => toast('error', 'Не удалось обновить статус'),
                  },
                );
              }}
            >
              <div className="field">
                <label htmlFor="patientStatus">CRM статус</label>
                <select
                  id="patientStatus"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  style={{ color: 'var(--ink)' }}
                >
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

          {/* CRM Tags management section */}
          <aside className="content-panel">
            <div className="panel-header">
              <div>
                <h2>CRM теги</h2>
                <p className="muted">Категории и маркеры визитов.</p>
              </div>
            </div>
            <div
              className="patient-tags"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}
            >
              {patientData.tags?.length ? (
                patientData.tags.map((t: any) => (
                  <span
                    key={t.tagId}
                    className="status-badge"
                    style={{
                      background: t.tag.color || 'var(--border)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  >
                    {t.tag.name}
                    <button
                      onClick={() => {
                        removeTag.mutate(t.tagId, {
                          onSuccess: () => toast('success', 'Тег удален'),
                          onError: () => toast('error', 'Не удалось удалить тег'),
                        });
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label="Удалить тег"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <span className="muted">Нет назначенных тегов</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="addTagSelect">Назначить тег</label>
              <select
                id="addTagSelect"
                onChange={(e) => {
                  if (e.target.value) {
                    assignTag.mutate(e.target.value, {
                      onSuccess: () => toast('success', 'Тег назначен'),
                      onError: () => toast('error', 'Не удалось назначить тег'),
                    });
                    e.target.value = '';
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">Выберите тег...</option>
                {allTags.data
                  ?.filter((t: any) => !patientData.tags?.some((pt: any) => pt.tagId === t.id))
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          </aside>

          {/* Internal Notes feed section */}
          <aside className="content-panel">
            <div className="panel-header">
              <div>
                <h2>Заметки клиники</h2>
                <p className="muted">Внутренний комментарий и pinned инфо.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newNoteText) return;
                addNote.mutate(
                  { noteText: newNoteText, isPinned: false },
                  {
                    onSuccess: () => {
                      setNewNoteText('');
                      toast('success', 'Заметка создана');
                    },
                    onError: () => toast('error', 'Ошибка создания заметки'),
                  },
                );
              }}
              style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
            >
              <input
                placeholder="Текст заметки..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '13px',
                }}
              />
              <button
                className="button"
                style={{ padding: '6px 14px', minHeight: 'auto', fontSize: '13px' }}
                disabled={addNote.isPending}
              >
                +
              </button>
            </form>

            <div
              className="list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {patientData.notes?.length ? (
                patientData.notes.map((note: any) => (
                  <div
                    key={note.id}
                    className="note-card"
                    style={{
                      padding: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        {new Date(note.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                      {note.isPinned && (
                        <Star size={11} fill="var(--warning)" color="var(--warning)" />
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ink)' }}>
                      {note.noteText}
                    </p>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
                  Нет заметок
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
