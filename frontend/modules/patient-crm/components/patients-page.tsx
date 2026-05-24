'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Filter, Plus, Search, UserPlus } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { can } from '@/shared/permissions/can';
import { statusLabel, statusTone } from '@/shared/ui/status';
import { useCreatePatient, usePatients } from '../hooks/use-patients';

export function PatientsPage({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const [q, setQ] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const patients = usePatients(q);
  const createPatient = useCreatePatient();
  const branchId = bootstrap.branches[0]?.id;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">CRM база</span>
          <h1>Пациенты</h1>
          <p>Единый реестр пациентов, контактов, статусов и возможных дублей.</p>
        </div>
        {can(bootstrap, 'patients.create') ? (
          <div className="page-actions">
            <a className="button" href="#new-patient">
              <Plus size={18} />
              Создать пациента
            </a>
          </div>
        ) : null}
      </div>

      <div className="grid-two">
        <section className="content-panel">
          <div className="toolbar">
            <label className="global-search search">
              <Search size={18} />
              <input placeholder="Поиск по ФИО, телефону или коду" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <button className="secondary-button" type="button">
              <Filter size={17} />
              Фильтры
            </button>
          </div>
        {patients.isLoading ? <p className="muted">Загрузка...</p> : null}
        {patients.error ? <p className="error">Не удалось загрузить пациентов</p> : null}
        {patients.data?.duplicateCandidates?.length ? <p className="warn">Найдены возможные дубли: {patients.data.duplicateCandidates.length}</p> : null}
          {patients.data?.items.length ? (
            <div className="data-surface">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Пациент</th>
                    <th>Контакт</th>
                    <th>Статус</th>
                    <th>Филиал</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.data.items.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <Link className="person-cell" href={`/patients/${patient.id}`}>
                          <span className="avatar">{patient.firstName[0]}{patient.lastName[0]}</span>
                          <span>
                            <strong>{patient.fullName}</strong>
                            <span>{patient.patientCode}</span>
                          </span>
                        </Link>
                      </td>
                      <td>{patient.contacts[0]?.value ?? <span className="muted">Без контакта</span>}</td>
                      <td>
                        <span className={`status-badge status-${statusTone(patient.status, 'patient')}`}>
                          {statusLabel(patient.status, 'patient')}
                        </span>
                      </td>
                      <td>{bootstrap.branches.find((branch) => branch.id === patient.registrationBranchId)?.name ?? 'Не указан'}</td>
                      <td>
                        <Link className="secondary-button" href={`/patients/${patient.id}`}>Открыть</Link>
                      </td>
                    </tr>
                  ))}
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

      {can(bootstrap, 'patients.create') ? (
        <aside className="content-panel" id="new-patient">
          <div className="panel-header">
            <div>
              <h2>Новый пациент</h2>
              <p className="muted">Минимальная CRM-карточка для быстрой записи.</p>
            </div>
            <UserPlus size={20} />
          </div>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              createPatient.mutate(
                { firstName, lastName, phone, registrationBranchId: branchId },
                {
                  onSuccess: () => {
                    setFirstName('');
                    setLastName('');
                    setPhone('');
                  }
                }
              );
            }}
          >
            <div className="field">
              <label htmlFor="firstName">Имя</label>
              <input id="firstName" placeholder="Например, Мадина" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Фамилия</label>
              <input id="lastName" placeholder="Например, Азизова" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Телефон</label>
              <input id="phone" placeholder="+992..." value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <button className="button" disabled={createPatient.isPending}>
              {createPatient.isPending ? 'Создание...' : 'Создать'}
            </button>
          </form>
        </aside>
      ) : null}
      </div>
    </>
  );
}
