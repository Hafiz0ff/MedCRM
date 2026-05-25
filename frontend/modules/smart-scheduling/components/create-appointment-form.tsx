'use client';

import { CalendarPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCreateAppointment, useDoctors, useServices } from '../hooks/use-scheduling';
import { usePatients } from '@/modules/patient-crm/hooks/use-patients';
import { BootstrapPayload } from '@/shared/types/bootstrap';
import { useToast } from '@/shared/ui/toast';

interface CreateAppointmentFormProps {
  bootstrap: BootstrapPayload;
  prefilledDoctorId?: string;
  prefilledTime?: string;
  onClearPrefills?: () => void;
}

export function CreateAppointmentForm({
  bootstrap,
  prefilledDoctorId,
  prefilledTime,
  onClearPrefills,
}: CreateAppointmentFormProps) {
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
  const { toast } = useToast();

  const selectedService = services.data?.find((service) => service.id === serviceId);
  const endAt = startAt
    ? new Date(
        new Date(startAt).getTime() + (selectedService?.durationMinutes ?? 30) * 60000,
      ).toISOString()
    : '';

  useEffect(() => {
    if (prefilledDoctorId) {
      setEmployeeId(prefilledDoctorId);
    }
  }, [prefilledDoctorId]);

  useEffect(() => {
    if (prefilledTime) {
      setStartAt(prefilledTime);
    }
  }, [prefilledTime]);

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
          create.mutate(
            {
              branchId,
              patientId,
              employeeId,
              serviceId: serviceId || undefined,
              startAt: new Date(startAt).toISOString(),
              endAt,
            },
            {
              onSuccess: () => {
                toast('success', 'Запись создана', 'Новый визит успешно добавлен в расписание');
                setPatientQuery('');
                setPatientId('');
                setEmployeeId('');
                setServiceId('');
                setStartAt('');
                if (onClearPrefills) onClearPrefills();
              },
              onError: (err: any) => {
                toast('error', 'Ошибка создания', err.message || 'Не удалось создать запись');
              },
            },
          );
        }}
      >
        <div className="field">
          <label htmlFor="patientQuery">Поиск пациента</label>
          <input
            id="patientQuery"
            placeholder="ФИО, телефон или код"
            value={patientQuery}
            onChange={(event) => setPatientQuery(event.target.value)}
            style={{
              color: 'var(--ink)',
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="patientId">Пациент *</label>
          <select
            id="patientId"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            style={{
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
            required
          >
            <option value="">Выберите пациента</option>
            {patients.data?.items.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName} ({patient.patientCode})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="employeeId">Врач *</label>
          <select
            id="employeeId"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            style={{
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
            required
          >
            <option value="">Выберите врача</option>
            {doctors.data?.map((doctor) => (
              <option key={`${doctor.id}:${doctor.branchId}`} value={doctor.id}>
                {doctor.name} · {doctor.role}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="serviceId">Услуга</label>
          <select
            id="serviceId"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            style={{
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <option value="">Без услуги</option>
            {services.data?.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.durationMinutes} мин
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="startAt">Дата и время *</label>
          <input
            id="startAt"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
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
        {create.error ? (
          <p className="error" style={{ fontSize: '12px', margin: 0 }}>
            Не удалось создать запись: {create.error.message}
          </p>
        ) : null}
        <button
          className="button"
          disabled={!patientId || !employeeId || !startAt || create.isPending}
          style={{ marginTop: '8px', justifyContent: 'center' }}
        >
          {create.isPending ? 'Создание...' : 'Записать'}
        </button>
      </form>
    </aside>
  );
}
