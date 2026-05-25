'use client';

import { Filter, Plus, Search, UserPlus, X, AlertTriangle, BadgeAlert, Coins } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useCreatePatient, usePatients, useListTags } from '../hooks/use-patients';
import { can } from '@/shared/permissions/can';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { statusLabel, statusTone } from '@/shared/ui/status';
import { useToast } from '@/shared/ui/toast';

export function PatientsPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const [q, setQ] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { toast } = useToast();

  const patients = usePatients(q, selectedStatus || undefined, selectedTagId || undefined);
  const createPatient = useCreatePatient();
  const allTags = useListTags();
  const branchId = bootstrap.branches[0]?.id;

  // Format Phone Helper
  const formatPhone = (phoneStr?: string) => {
    if (!phoneStr) return 'Без контакта';
    const cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('992')) {
      return `+992 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
    }
    return phoneStr;
  };

  const formatDateShort = (value?: string | null) => {
    if (!value) return 'Не указана';
    return new Date(value).toLocaleDateString('ru-RU');
  };

  const statusFilters = [
    { value: '', label: 'Все' },
    { value: 'ACTIVE', label: 'Активные' },
    { value: 'NEW', label: 'Новые' },
    { value: 'VIP', label: 'VIP' },
    { value: 'BLOCKED', label: 'Ограничения' },
  ];

  // Duplicate Check Query
  const duplicateSearchTerm = phone.length > 5 ? phone : lastName.length > 2 ? lastName : '';
  const duplicateCheckQuery = usePatients(duplicateSearchTerm);
  const duplicateCandidates = duplicateSearchTerm
    ? duplicateCheckQuery.data?.duplicateCandidates || []
    : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast('error', 'Ошибка заполнения', 'Заполните имя и фамилию');
      return;
    }
    createPatient.mutate(
      { firstName, lastName, phone, registrationBranchId: branchId },
      {
        onSuccess: (newPatient) => {
          toast('success', 'Пациент создан', `${newPatient.fullName} успешно зарегистрирован`);
          setFirstName('');
          setLastName('');
          setPhone('');
          setIsDrawerOpen(false);
        },
        onError: () => {
          toast('error', 'Ошибка создания', 'Не удалось создать карточку пациента');
        },
      },
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">CRM база</span>
          <h1>Пациенты</h1>
          <p>Единый реестр пациентов, контактов, статусов, тегов и возможных дублей.</p>
        </div>
        {can(bootstrap, 'patients.create') ? (
          <div className="page-actions">
            <button className="button" onClick={() => setIsDrawerOpen(true)} type="button">
              <Plus size={18} />
              Создать пациента
            </button>
          </div>
        ) : null}
      </div>

      <div className="workspace-grid">
        <section className="content-panel">
          {/* Toolbar */}
          <div
            className="toolbar"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
          >
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <label className="global-search search" style={{ flex: 1 }}>
                <Search size={18} />
                <input
                  placeholder="Поиск по ФИО, телефону или коду"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </label>
              <button className="secondary-button" type="button">
                Экспорт
              </button>
              <button
                className={`secondary-button ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
                type="button"
              >
                <Filter size={17} />
                Фильтры
              </button>
            </div>

            <div className="segmented" aria-label="Фильтр по статусу">
              {statusFilters.map((filter) => (
                <button
                  className={selectedStatus === filter.value ? 'active' : undefined}
                  key={filter.value}
                  onClick={() => setSelectedStatus(filter.value)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {showFilters && (
              <div
                className="filter-panel"
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--surface-soft)',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                }}
              >
                <div className="field" style={{ margin: 0, minWidth: '160px', flex: 1 }}>
                  <label
                    htmlFor="statusFilter"
                    style={{
                      fontSize: '11px',
                      marginBottom: '4px',
                      display: 'block',
                      fontWeight: 600,
                    }}
                  >
                    Статус
                  </label>
                  <select
                    id="statusFilter"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      width: '100%',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="">Все статусы</option>
                    <option value="NEW">Новый</option>
                    <option value="ACTIVE">Активный</option>
                    <option value="SLEEPING">Спящий</option>
                    <option value="VIP">VIP</option>
                    <option value="BLOCKED">Ограничен</option>
                  </select>
                </div>

                <div className="field" style={{ margin: 0, minWidth: '160px', flex: 1 }}>
                  <label
                    htmlFor="tagFilter"
                    style={{
                      fontSize: '11px',
                      marginBottom: '4px',
                      display: 'block',
                      fontWeight: 600,
                    }}
                  >
                    Тег
                  </label>
                  <select
                    id="tagFilter"
                    value={selectedTagId}
                    onChange={(e) => setSelectedTagId(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      width: '100%',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="">Все теги</option>
                    {allTags.data?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {(selectedStatus || selectedTagId) && (
                  <button
                    className="secondary-button"
                    style={{
                      height: '32px',
                      minHeight: 'auto',
                      padding: '0 12px',
                      fontSize: '12px',
                    }}
                    onClick={() => {
                      setSelectedStatus('');
                      setSelectedTagId('');
                    }}
                    type="button"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            )}
          </div>

          {patients.isLoading ? <p className="muted">Загрузка...</p> : null}
          {patients.error ? <p className="error">Не удалось загрузить пациентов</p> : null}

          {patients.data?.items.length ? (
            <div className="data-surface">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Пациент</th>
                    <th>Телефон</th>
                    <th>Дата рождения</th>
                    <th>Врач</th>
                    <th>Последний визит</th>
                    <th>Баланс</th>
                    <th>Статус</th>
                    <th>CRM теги</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.data.items.map((patient) => {
                    const primaryPhone =
                      patient.contacts?.find((c: any) => c.isPrimary)?.value ||
                      patient.contacts?.[0]?.value;
                    const debt =
                      (patient as any).invoices?.reduce(
                        (sum: number, inv: any) => sum + Number(inv.totalAmount),
                        0,
                      ) || 0;
                    return (
                      <tr key={patient.id}>
                        <td>
                          <Link
                            className="person-cell"
                            href={`/patients/${patient.id}`}
                            style={{ gap: '10px' }}
                          >
                            <span
                              className="avatar"
                              style={{
                                width: '32px',
                                height: '32px',
                                fontSize: '12px',
                                display: 'grid',
                                placeItems: 'center',
                                background: 'var(--brand-soft)',
                                color: 'var(--brand)',
                                borderRadius: '50%',
                                fontWeight: 'bold',
                              }}
                            >
                              {patient.firstName?.[0] || 'П'}
                              {patient.lastName?.[0] || ''}
                            </span>
                            <span>
                              <strong
                                style={{
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                {patient.fullName}
                                {debt > 0 && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      background: 'var(--danger-soft)',
                                      color: 'var(--danger)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 'bold',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                  >
                                    <Coins size={10} /> Долг: {debt} ₽
                                  </span>
                                )}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {patient.patientCode}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--ink)' }}>
                          {formatPhone(primaryPhone)}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {formatDateShort(patient.birthDate)}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--ink)' }}>
                          {(patient as any).primaryDoctorName ?? 'Не назначен'}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--muted)' }}>
                          {formatDateShort((patient as any).metrics?.lastVisitAt)}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${debt > 0 ? 'status-danger' : 'status-success'}`}
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                          >
                            {debt > 0 ? `${debt} ₽ долг` : '0 ₽'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge status-${statusTone(patient.status, 'patient')}`}
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                          >
                            {statusLabel(patient.status, 'patient')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(patient as any).tags?.map((t: any) => (
                              <span
                                key={t.tag.id}
                                className="status-badge"
                                style={{
                                  background: t.tag.color || 'var(--surface-soft)',
                                  color: '#1e293b',
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {t.tag.name}
                              </span>
                            ))}
                            {!(patient as any).tags?.length && (
                              <span className="muted" style={{ fontSize: '11px' }}>
                                —
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <Link
                            className="secondary-button"
                            href={`/patients/${patient.id}`}
                            style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                          >
                            Открыть
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : !patients.isLoading ? (
            <div className="empty-state">
              <div>
                <strong>Пациенты не найдены</strong>
                <span>Измените поиск или создайте новую карточку пациента.</span>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="content-panel">
          <div className="panel-header">
            <div>
              <h2>Новый пациент</h2>
              <p className="muted">Минимальная CRM-карточка для быстрой записи.</p>
            </div>
            <UserPlus size={18} className="muted" />
          </div>
          <button
            className="button"
            onClick={() => setIsDrawerOpen(true)}
            style={{ width: '100%' }}
            type="button"
          >
            <Plus size={18} />
            Создать пациента
          </button>
          <div className="section-gap">
            <div className="compact-stat">
              <span>Всего в выборке</span>
              <strong>{patients.data?.total ?? 0}</strong>
            </div>
            <div className="compact-stat">
              <span>Фильтр статуса</span>
              <strong>
                {statusFilters.find((filter) => filter.value === selectedStatus)?.label ?? 'Все'}
              </strong>
            </div>
            <div className="compact-stat">
              <span>Доступные теги</span>
              <strong>{allTags.data?.length ?? 0}</strong>
            </div>
          </div>
        </aside>
      </div>

      {/* Creation Drawer */}
      {isDrawerOpen && (
        <>
          <div className="slide-over-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <aside className="slide-over" style={{ width: '400px', maxWidth: '100%' }}>
            <div
              className="slide-over-header"
              style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
            >
              <h2>Новый пациент</h2>
              <button
                className="icon-button"
                onClick={() => setIsDrawerOpen(false)}
                type="button"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto',
                height: 'calc(100% - 70px)',
              }}
            >
              <p className="muted" style={{ fontSize: '12px' }}>
                Быстрое добавление пациента для резервирования приемов.
              </p>

              <form
                className="form"
                onSubmit={handleCreate}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 0 }}
              >
                <div className="field">
                  <label htmlFor="firstName" style={{ fontSize: '11px', fontWeight: 600 }}>
                    Имя *
                  </label>
                  <input
                    id="firstName"
                    placeholder="Например, Мадина"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    style={{
                      color: 'var(--ink)',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="lastName" style={{ fontSize: '11px', fontWeight: 600 }}>
                    Фамилия *
                  </label>
                  <input
                    id="lastName"
                    placeholder="Например, Азизова"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    style={{
                      color: 'var(--ink)',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone" style={{ fontSize: '11px', fontWeight: 600 }}>
                    Телефон
                  </label>
                  <input
                    id="phone"
                    placeholder="+992..."
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    style={{
                      color: 'var(--ink)',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  />
                </div>

                {/* Inline Duplicate Checking Alert */}
                {duplicateCandidates.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid var(--danger)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertTriangle size={14} /> Обнаружено совпадение! (
                      {duplicateCandidates.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {duplicateCandidates.map((dup: any) => (
                        <div
                          key={dup.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '11px',
                            borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                            paddingBottom: '4px',
                          }}
                        >
                          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                            {dup.fullName} ({dup.patientCode})
                          </span>
                          <Link
                            href={`/patients/${dup.id}`}
                            className="secondary-button"
                            style={{
                              padding: '2px 6px',
                              minHeight: 'auto',
                              fontSize: '10px',
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            Открыть
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Отмена
                  </button>
                  <button
                    className="button"
                    disabled={createPatient.isPending}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {createPatient.isPending ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
