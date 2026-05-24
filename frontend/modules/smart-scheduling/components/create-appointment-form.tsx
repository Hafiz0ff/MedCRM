'use client';

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { usePatients } from '@/modules/patient-crm/hooks/use-patients';
import { useCreateAppointment, useDoctors, useServices } from '../hooks/use-scheduling';

export function CreateAppointmentForm({ bootstrap }: { bootstrap: BootstrapPayload }) {
  const branchId = bootstrap.branches[0]?.id ?? '';
  const [patientQuery, setPatientQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [startAt, setStartAt] = useState('');
  const patients = usePatients(patientQuery);
  const doctors = useDoctors();
  const services = useServices();
  const create = useCreateAppointment();

  const selectedService = services.data?.find((service) => service.id === serviceId);
  const endAt = startAt
    ? new Date(new Date(startAt).getTime() + (selectedService?.durationMinutes ?? 30) * 60000).toISOString()
    : '';

  return (
    <aside className="content-panel" id="create-appointment">
      <div className="panel-header">
        <div>
          <h2>Создать запись</h2>
          <p className="muted">Выберите пациента, врача, услугу и время визита.</p>
        </div>
        <CalendarPlus size={20} />
      </div>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ branchId, patientId, employeeId, serviceId: serviceId || undefined, startAt: new Date(startAt).toISOString(), endAt });
        }}
      >
        <div className="field">
          <label htmlFor="patientQuery">Поиск пациента</label>
          <input id="patientQuery" placeholder="ФИО, телефон или код" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="patientId">Пациент</label>
          <select id="patientId" value={patientId} onChange={(event) => setPatientId(event.target.value)}>
            <option value="">Выберите пациента</option>
            {patients.data?.items.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.fullName}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="employeeId">Врач</label>
          <select id="employeeId" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Выберите врача</option>
            {doctors.data?.map((doctor) => (
              <option key={`${doctor.id}:${doctor.branchId}`} value={doctor.id}>{doctor.name} · {doctor.role}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="serviceId">Услуга</label>
          <select id="serviceId" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">Без услуги</option>
            {services.data?.map((service) => (
              <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} мин</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="startAt">Дата и время</label>
          <input id="startAt" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        </div>
        {create.error ? <p className="error">Не удалось создать запись: {create.error.message}</p> : null}
        <button className="button" disabled={!patientId || !employeeId || !startAt || create.isPending}>
          {create.isPending ? 'Создание...' : 'Записать'}
        </button>
      </form>
    </aside>
  );
}
