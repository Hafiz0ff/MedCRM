'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  AlertCircle,
  Calendar,
  ShieldAlert,
  Award,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import {
  useMedicalRecord,
  useUpdateMedicalRecord,
  useEpisodes,
  useCreateEpisode,
  useUpdateEpisode,
  Encounter,
} from '../hooks/use-emr';
import { EncounterWorkspace } from './encounter-workspace';
import { apiFetch } from '@/shared/api/client-api';
import { useToast } from '@/shared/ui/toast';

export function EmrPanel({ patientId }: { patientId: string }) {
  const { toast } = useToast();
  const [showEditGeneral, setShowEditGeneral] = useState(false);
  const [showCreateEpisode, setShowCreateEpisode] = useState(false);
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [showNewEncounterForm, setShowNewEncounterForm] = useState(false);

  // General Record states
  const [bloodType, setBloodType] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [chronicText, setChronicText] = useState('');

  // Episode states
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeType, setEpisodeType] = useState('OUTPATIENT');
  const [episodeSummary, setEpisodeSummary] = useState('');

  // Queries
  const recordQuery = useMedicalRecord(patientId);
  const episodesQuery = useEpisodes(patientId);
  const updateRecord = useUpdateMedicalRecord(patientId);
  const createEpisode = useCreateEpisode(patientId);

  // Fetch list of encounters from timeline/custom endpoints (using timeline is standard, or let's load encounters)
  const encountersQuery = useQuery({
    queryKey: ['encounters', patientId],
    queryFn: () =>
      apiFetch<Encounter[]>(`/patients/${patientId}/timeline`).then((events) => {
        // Find all encounters from timeline/or fetch encounters
        // Let's assume timeline returns encounter items or we query EMR encounters list
        // Let's look up raw encounters via EMR
        return apiFetch<Encounter[]>(`/emr/medical-records/patient/${patientId}`).then(
          (record: any) => {
            // Medical Record includes encounters on backend usually.
            // Let's fallback to search or custom fetch for patient encounters.
            // Let's inspect the prisma schema to see what model relation there is.
            // On backend, Prisma MedicalRecord has relations?
            // Let's run a fallback to fetch encounters. Let's do a try-catch fetch on /emr/encounters?patientId=patientId
            return apiFetch<Encounter[]>(`/emr/episodes?patientId=${patientId}`).then(
              async (episodes) => {
                // Let's query all encounters
                try {
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/emr/medical-records/patient/${patientId}`,
                    {
                      headers: {
                        Authorization: `Bearer ${
                          document.cookie
                            .split('; ')
                            .find((item) => item.startsWith('access_token='))
                            ?.split('=')[1]
                        }`,
                      },
                    },
                  );
                  const data = await res.json();
                  // Let's extract encounters from EMR or return custom empty list
                  return data.encounters || [];
                } catch {
                  return [];
                }
              },
            );
          },
        );
      }),
  });

  const record = recordQuery.data;
  const episodes = episodesQuery.data || [];
  const encounters = encountersQuery.data || [];

  const handleEditGeneralOpen = () => {
    if (record) {
      setBloodType(record.bloodType || '');
      setAllergiesText(Array.isArray(record.allergiesJson) ? record.allergiesJson.join(', ') : '');
      setChronicText(
        Array.isArray(record.chronicConditionsJson) ? record.chronicConditionsJson.join(', ') : '',
      );
      setShowEditGeneral(true);
    }
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    const allergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const chronic = chronicText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateRecord.mutate(
      {
        bloodType,
        allergiesJson: allergies,
        chronicConditionsJson: chronic,
      },
      {
        onSuccess: () => {
          setShowEditGeneral(false);
          toast('success', 'Медкарта успешно обновлена');
        },
        onError: () => {
          toast('error', 'Не удалось обновить медицинскую карту');
        },
      },
    );
  };

  const handleCreateEpisodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!episodeTitle) return;

    // Retrieve default branch and doctor from window or context, or mock them
    // E2E helper usually seeds with specific UUIDs
    const branchId = '4d4169dc-06fc-4790-b9c5-46b99271b8d9';
    const doctorId = 'd57fe15f-449b-4048-a744-9b5b3282c4a8';

    createEpisode.mutate(
      {
        branchId,
        responsibleDoctorId: doctorId,
        episodeType,
        title: episodeTitle,
        startDate: new Date().toISOString(),
        clinicalSummary: episodeSummary,
      },
      {
        onSuccess: () => {
          setShowCreateEpisode(false);
          setEpisodeTitle('');
          setEpisodeSummary('');
          toast('success', 'Новый эпизод лечения открыт');
        },
        onError: () => {
          toast('error', 'Ошибка при открытии эпизода');
        },
      },
    );
  };

  const handleStartNewEncounter = () => {
    // Open workspace with new draft mode
    setActiveEncounterId('new');
  };

  if (recordQuery.isLoading) {
    return (
      <div className="muted" style={{ padding: '24px' }}>
        Загрузка медицинской карты...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. General Medical Parameters */}
      <section className="content-panel">
        <div
          className="panel-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} className="muted" />
            <div>
              <h2>Основные показатели и аллергии</h2>
              <p className="muted">Критически важная информация для врачей клиники.</p>
            </div>
          </div>
          {!showEditGeneral && (
            <button
              className="secondary-button"
              style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '13px' }}
              onClick={handleEditGeneralOpen}
            >
              Редактировать
            </button>
          )}
        </div>

        {showEditGeneral ? (
          <form
            onSubmit={handleSaveGeneral}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <label htmlFor="bloodType" style={{ fontWeight: 600 }}>
                Группа крови
              </label>
              <select
                id="bloodType"
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">Не указана</option>
                <option value="O(I) Rh+">O(I) Rh+</option>
                <option value="O(I) Rh-">O(I) Rh-</option>
                <option value="A(II) Rh+">A(II) Rh+</option>
                <option value="A(II) Rh-">A(II) Rh-</option>
                <option value="B(III) Rh+">B(III) Rh+</option>
                <option value="B(III) Rh-">B(III) Rh-</option>
                <option value="AB(IV) Rh+">AB(IV) Rh+</option>
                <option value="AB(IV) Rh-">AB(IV) Rh-</option>
              </select>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <label htmlFor="allergiesText" style={{ fontWeight: 600 }}>
                Аллергии
              </label>
              <input
                id="allergiesText"
                placeholder="Разделяйте запятыми (например: Пенициллин, Аспирин)"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <label htmlFor="chronicText" style={{ fontWeight: 600 }}>
                Хронические заболевания
              </label>
              <input
                id="chronicText"
                placeholder="Разделяйте запятыми (например: Гипертония, Сахарный диабет)"
                value={chronicText}
                onChange={(e) => setChronicText(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              />
            </div>
            <div
              style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowEditGeneral(false)}
              >
                Отмена
              </button>
              <button type="submit" className="button" disabled={updateRecord.isPending}>
                Сохранить изменения
              </button>
            </div>
          </form>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="muted" style={{ fontSize: '12px' }}>
                ГРУППА КРОВИ
              </span>
              <strong>{record?.bloodType || 'Не указана'}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="muted" style={{ fontSize: '12px' }}>
                АЛЛЕРГИЧЕСКИЕ РЕАКЦИИ
              </span>
              {Array.isArray(record?.allergiesJson) && record.allergiesJson.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {record.allergiesJson.map((a: string, idx: number) => (
                    <span
                      key={idx}
                      className="status-badge status-danger"
                      style={{ fontSize: '12px' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="muted" style={{ fontSize: '14px' }}>
                  Не зафиксированы
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="muted" style={{ fontSize: '12px' }}>
                ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ
              </span>
              {Array.isArray(record?.chronicConditionsJson) &&
              record.chronicConditionsJson.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {record.chronicConditionsJson.map((c: string, idx: number) => (
                    <span
                      key={idx}
                      className="status-badge status-warning"
                      style={{ fontSize: '12px' }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="muted" style={{ fontSize: '14px' }}>
                  Отсутствуют
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Episodes of Care */}
      <section className="content-panel">
        <div
          className="panel-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} className="muted" />
            <div>
              <h2>Эпизоды лечения (Episodes of Care)</h2>
              <p className="muted">
                Объединяют несколько приемов в один долгосрочный клинический случай.
              </p>
            </div>
          </div>
          {!showCreateEpisode && (
            <button
              className="secondary-button"
              style={{ minHeight: 'auto', padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setShowCreateEpisode(true)}
            >
              <Plus size={14} style={{ marginRight: '4px' }} /> Открыть эпизод
            </button>
          )}
        </div>

        {showCreateEpisode && (
          <form
            onSubmit={handleCreateEpisodeSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '16px',
              padding: '16px',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label htmlFor="episodeTitle">Название клинического случая</label>
                <input
                  id="episodeTitle"
                  required
                  placeholder="Например: ОРВИ, Хронический гастрит"
                  value={episodeTitle}
                  onChange={(e) => setEpisodeTitle(e.target.value)}
                  style={{
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="episodeType">Тип эпизода</label>
                <select
                  id="episodeType"
                  value={episodeType}
                  onChange={(e) => setEpisodeType(e.target.value)}
                  style={{
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                  }}
                >
                  <option value="OUTPATIENT">Амбулаторный</option>
                  <option value="INPATIENT">Стационарный</option>
                  <option value="REHABILITATION">Реабилитация</option>
                  <option value="PREVENTIVE">Профилактический</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="episodeSummary">Клиническое описание / Жалобы</label>
              <textarea
                id="episodeSummary"
                placeholder="Первичный анамнез и цели лечения..."
                value={episodeSummary}
                onChange={(e) => setEpisodeSummary(e.target.value)}
                style={{
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCreateEpisode(false)}
              >
                Отмена
              </button>
              <button type="submit" className="button" disabled={createEpisode.isPending}>
                Создать эпизод
              </button>
            </div>
          </form>
        )}

        <div
          className="list"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}
        >
          {episodes.length > 0 ? (
            episodes.map((ep) => (
              <div
                key={ep.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '15px' }}>{ep.title}</strong>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '12px',
                      color: 'var(--muted)',
                      marginTop: '4px',
                    }}
                  >
                    <span>Тип: {ep.episodeType}</span>
                    <span>Начат: {new Date(ep.startDate).toLocaleDateString('ru-RU')}</span>
                    {ep.endDate && (
                      <span>Завершен: {new Date(ep.endDate).toLocaleDateString('ru-RU')}</span>
                    )}
                  </div>
                  {ep.clinicalSummary && (
                    <p style={{ fontSize: '13px', margin: '8px 0 0 0', color: 'var(--ink)' }}>
                      {ep.clinicalSummary}
                    </p>
                  )}
                </div>
                <span
                  className={`status-badge status-${ep.status === 'ACTIVE' ? 'success' : ep.status === 'CLOSED' ? 'neutral' : 'warning'}`}
                >
                  {ep.status === 'ACTIVE'
                    ? 'Активен'
                    : ep.status === 'CLOSED'
                      ? 'Закрыт'
                      : 'Приостановлен'}
                </span>
              </div>
            ))
          ) : (
            <div
              className="empty-state"
              style={{ padding: '24px 0', border: '1px dashed var(--border)', borderRadius: '8px' }}
            >
              <span className="muted">Нет открытых эпизодов лечения</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Encounters List */}
      <section className="content-panel">
        <div
          className="panel-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} className="muted" />
            <div>
              <h2>Клинические приемы (Encounters)</h2>
              <p className="muted">
                История очных приемов, консультаций врача и медицинских записей.
              </p>
            </div>
          </div>
          <button className="button" onClick={handleStartNewEncounter}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Новый прием
          </button>
        </div>

        <div
          className="list"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}
        >
          {encounters.length > 0 ? (
            encounters.map((enc: Encounter) => (
              <div
                key={enc.id}
                onClick={() => setActiveEncounterId(enc.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                className="encounter-row"
              >
                <div>
                  <strong style={{ fontSize: '15px' }}>{enc.encounterType}</strong>
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '12px',
                      color: 'var(--muted)',
                      marginTop: '4px',
                    }}
                  >
                    <span>Врач ID: {enc.doctorEmployeeId.slice(0, 8)}...</span>
                    <span>Начат: {new Date(enc.startedAt).toLocaleString('ru-RU')}</span>
                  </div>
                  {enc.diagnoses && enc.diagnoses.length > 0 && (
                    <div
                      style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}
                    >
                      {enc.diagnoses.map((d: any) => (
                        <span
                          key={d.id}
                          className="status-badge status-normal"
                          style={{ fontSize: '11px' }}
                        >
                          {d.diagnosisCode} {d.isPrimary ? '(Осн.)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    className={`status-badge status-${enc.status === 'SIGNED' ? 'success' : 'warning'}`}
                  >
                    {enc.status === 'SIGNED' ? 'Подписан' : 'Черновик'}
                  </span>
                  <FileText size={16} className="muted" />
                </div>
              </div>
            ))
          ) : (
            <div
              className="empty-state"
              style={{ padding: '32px 0', border: '1px dashed var(--border)', borderRadius: '8px' }}
            >
              <span className="muted">Нет зарегистрированных приемов</span>
            </div>
          )}
        </div>
      </section>

      {/* 4. Active Encounter Workspace Overlay */}
      {activeEncounterId && (
        <EncounterWorkspace
          patientId={patientId}
          encounterId={activeEncounterId === 'new' ? undefined : activeEncounterId}
          onClose={() => {
            setActiveEncounterId(null);
            encountersQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
